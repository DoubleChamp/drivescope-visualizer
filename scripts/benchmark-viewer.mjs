import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Production 서버를 먼저 실행한다. 실패 응답은 이 브라우저의 manifest 요청에만 적용한다.
const baseUrl = new URL(process.env.DRIVESCOPE_BENCHMARK_URL ?? "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname), "로컬 서버 URL을 사용하세요.");
const chromePath = process.env.DRIVESCOPE_BENCHMARK_CHROME ??
  (process.platform === "win32"
    ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Google/Chrome/Application/chrome.exe")
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");
await access(chromePath);
const manifestResponse = await fetch(new URL("/api/drivescope-data/manifest.json", baseUrl));
assert.equal(manifestResponse.status, 200, "실제 데이터 manifest가 준비돼야 합니다.");
const manifest = await manifestResponse.json();
assert.equal(manifest.schemaVersion, 3);
const seekTimesMs = [1000, 5000, 10000, 12400, 14500];
assert.ok(manifest.durationMs >= seekTimesMs.at(-1));
const playbackSamples = 10;
const viewport = { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false };
const outputDirectory = path.resolve("node_modules/.cache/drivescope-benchmark");
await mkdir(outputDirectory, { recursive: true });
const profile = await mkdtemp(path.join(outputDirectory, "chrome-profile-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", "--enable-unsafe-swiftshader",
  `--user-data-dir=${profile}`, "about:blank",
], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;
try {
  const debuggerUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Chrome 시작 시간 초과")), 20000);
    chrome.once("error", error => { clearTimeout(timer); reject(error); });
    chrome.stderr.on("data", data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    chrome.once("exit", () => { clearTimeout(timer); reject(new Error("Chrome이 종료됐습니다.")); });
  });
  const targets = await (await fetch(`http://127.0.0.1:${new URL(debuggerUrl).port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let commandId = 0;
  const pending = new Map();
  const exceptions = [];
  let sourceMode = "actual";
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
    if (message.method === "Fetch.requestPaused") {
      const requestId = message.params.requestId;
      const action = sourceMode === "mock"
        ? send("Fetch.fulfillRequest", { requestId, responseCode: 404, body: "" })
        : send("Fetch.continueRequest", { requestId });
      void action.catch(error => exceptions.push({ message: error.message }));
    }
    if (!message.id) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
  };
  const evaluate = async expression => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const waitFor = async expression => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    throw new Error(`대기 시간 초과: ${expression}`);
  };
  // 기존 UI 값을 읽는다. 앱 state나 Three.js 루프에는 측정 코드를 추가하지 않는다.
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", viewport);
  await send("Fetch.enable", { patterns: [{ urlPattern: "*api/drivescope-data/manifest.json" }] });
  const readMetrics = async () => evaluate(String.raw`(() => {
    const root = document.querySelector('[aria-label="뷰어 통계"]');
    const fields = Object.fromEntries([...root.children].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
    const cache = fields['LiDAR 캐시'];
    const size = cache.match(/(\d+)\/(\d+)개/);
    const load = fields['Frame 로딩'];
    return {
      pointCount: Number(fields['포인트 수'].replaceAll(',', '')),
      fps: Number(fields['FPS']),
      currentTimeMs: Number(document.querySelector('input[type=range]').value),
      cacheStatus: cache.startsWith('hit') ? 'hit' : cache.startsWith('miss') ? 'miss' : cache,
      cacheEntries: Number(size[1]), cacheCapacity: Number(size[2]),
      loadDurationMs: /^\d/.test(load) ? Number(load.replace('ms', '')) : null,
      loadLabel: load,
    };
  })()`);
  const latestActualFrame = time => manifest.lidar.frames.filter(frame => frame.timestampMs <= time).at(-1);
  const expectedPoints = time => sourceMode === "actual"
    ? latestActualFrame(time)?.pointCount ?? 0
    : time >= 10000 ? 21 : 15;
  const seek = async time => {
    await evaluate(`(() => {
      const input = document.querySelector('input[type=range]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${time}');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    await waitFor(`Number(document.querySelector('input[type=range]').value) === ${time}`);
    await waitFor(`(() => {
      const rows = document.querySelector('[aria-label="뷰어 통계"]').children;
      return Number(rows[0].querySelector('dd').textContent.replaceAll(',', '')) === ${expectedPoints(time)}
        && !rows[3].textContent.includes('로딩 중') && !rows[3].textContent.includes('로딩 실패');
    })()`);
  };
  const trials = [];
  let environment;
  for (const [roundIndex, modes] of [["mock", "actual"], ["actual", "mock"], ["mock", "actual"]].entries()) {
    for (const mode of modes) {
      sourceMode = mode;
      await send("Page.navigate", { url: new URL("/viewer", baseUrl).href });
      await waitFor(`document.querySelector('input[type=range]')?.max === '${mode === "actual" ? manifest.durationMs : 15000}' && document.querySelector('img[data-active="true"]')?.naturalWidth > 0`);
      if (mode === "actual") assert.equal(await evaluate(`!!document.querySelector('[role="alert"]')`), false);
      else assert.ok(await evaluate(`document.querySelector('[role="alert"]')?.textContent.includes('가상 데모')`));
      if (!environment) environment = await evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        const gl = canvas.getContext('webgl2');
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
          graphicsRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          canvasWidth: canvas.width, canvasHeight: canvas.height,
        };
      })()`);
      const misses = [];
      for (const time of seekTimesMs) {
        await seek(time);
        const measurement = await readMetrics();
        assert.equal(measurement.cacheStatus, "miss", "멀리 떨어진 seek는 cache miss로 측정해야 합니다.");
        assert.notEqual(measurement.loadDurationMs, null);
        assert.ok(measurement.cacheEntries <= measurement.cacheCapacity);
        misses.push({ targetTimeMs: time, pointCount: measurement.pointCount, loadDurationMs: measurement.loadDurationMs });
      }
      // 인접 Frame을 거쳐 직전 Frame으로 돌아와 hit와 로더 생략을 확인한다.
      const lastTime = seekTimesMs.at(-1);
      let neighborTime = lastTime - 500;
      if (mode === "actual") {
        const currentIndex = manifest.lidar.frames.indexOf(latestActualFrame(lastTime));
        neighborTime = Math.ceil(manifest.lidar.frames[currentIndex - 1].timestampMs / 100) * 100;
      }
      await seek(neighborTime);
      await seek(lastTime);
      const hit = await readMetrics();
      assert.equal(hit.cacheStatus, "hit");
      assert.equal(hit.loadLabel, "캐시로 생략");
      await seek(0);
      await delay(2200); // 초기 리소스 준비와 첫 FPS 집계 구간을 측정에서 제외한다.
      await evaluate(`document.querySelector('button[aria-pressed]').click()`);
      const playback = [];
      for (let index = 0; index < playbackSamples; index++) {
        await delay(1000);
        const measurement = await readMetrics();
        assert.ok(Number.isFinite(measurement.fps) && measurement.fps > 0);
        assert.ok(measurement.cacheEntries <= 5);
        playback.push({ currentTimeMs: measurement.currentTimeMs, pointCount: measurement.pointCount, fps: measurement.fps });
      }
      await evaluate(`document.querySelector('button[aria-pressed]').click()`);
      assert.ok(playback.at(-1).currentTimeMs >= 9000 && playback.at(-1).currentTimeMs < 13000);
      trials.push({ round: roundIndex + 1, mode, misses, hit: { targetTimeMs: lastTime, cacheStatus: hit.cacheStatus, loadLabel: hit.loadLabel }, playback });
      console.log(`round ${roundIndex + 1} ${mode}: seek miss ${misses.map(value => value.loadDurationMs).join(', ')}ms; FPS ${playback.map(value => value.fps).join(', ')}`);
    }
  }
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  const summarize = values => {
    const sorted = values.toSorted((a, b) => a - b);
    const middle = sorted.length / 2;
    return { count: sorted.length, min: sorted[0], median: sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2, max: sorted.at(-1) };
  };
  const summaries = Object.fromEntries(["mock", "actual"].map(mode => {
    const matching = trials.filter(trial => trial.mode === mode);
    return [mode, {
      seekMissLoadDurationMs: summarize(matching.flatMap(trial => trial.misses.map(value => value.loadDurationMs))),
      seekPointCount: summarize(matching.flatMap(trial => trial.misses.map(value => value.pointCount))),
      playbackFps: summarize(matching.flatMap(trial => trial.playback.map(value => value.fps))),
      cacheHitChecksPassed: matching.length,
    }];
  }));
  const result = {
    measuredAt: new Date().toISOString(), nodeVersion: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    environment, viewport, source: { actualScenarioId: manifest.scenarioId, schemaVersion: manifest.schemaVersion },
    protocol: { rounds: 3, seekTimesMs, playbackSamplesPerRound: playbackSamples, fpsSampleIntervalMs: 1000, uiLoadDurationPrecisionMs: 0.01, browserHttpCache: "disabled", lidarLruCapacity: 5 },
    summaries, trials, runtimeExceptionCount: exceptions.length,
  };
  await writeFile(path.join(outputDirectory, "latest.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ environment, summaries, result: "node_modules/.cache/drivescope-benchmark/latest.json" }, null, 2));
} finally {
  ws?.close();
  chrome.kill();
}
