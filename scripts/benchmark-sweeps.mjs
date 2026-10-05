import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import os from "node:os";
import { withChromePage, delay } from "./lib/chrome-page.mjs";
import { installPerformanceProbe } from "./lib/browser-performance-probe.mjs";
import { summarize, summarizeMainThread } from "./lib/performance-summary.mjs";

const upstream = new URL(process.env.DRIVESCOPE_BENCHMARK_URL ?? "http://localhost:3100");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname));
const root = path.resolve(process.env.DRIVESCOPE_SWEEPS_OUTPUT ?? "node_modules/.cache/drivescope-sweeps");
const offline = JSON.parse(await readFile(path.join(root, "offline.json"), "utf8"));
const variants = Object.keys(offline.variants);
const manifests = Object.fromEntries(await Promise.all(variants.map(async variant => [variant,
  JSON.parse(await readFile(path.join(root, variant, offline.scenarioId, "manifest.json"), "utf8"))])));
// 기존 실제 keyframe 출력과 같은 좌표/시간 기준인지 HTTP 원본까지 비교한다.
const original = await (await fetch(new URL("/api/drivescope-data/manifest.json", upstream))).json();
assert.deepEqual(original, manifests.keyframes);
for (const frame of original.lidar.frames) {
  const originalBytes = Buffer.from(await (await fetch(new URL(`/api/drivescope-data/${frame.positionsFile}`, upstream))).arrayBuffer());
  assert.deepEqual(originalBytes, await readFile(path.join(root, "keyframes", offline.scenarioId, frame.positionsFile)));
}

let activeVariant = "keyframes";
const requests = [];
// 같은 localhost origin에서 production UI는 그대로 proxy하고 센서 자산만 교체한다.
// Next route와 같은 readFile/no-store 계약. 환경변수/공개 데이터/Viewer 코드를 바꾸지 않는다.
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api/drivescope-data/")) {
      const asset = pathname.slice("/api/drivescope-data/".length);
      if (!/^(manifest\.json|lidar\/[\w.-]+\.bin|camera\/[\w.-]+\.jpe?g)$/.test(asset)) {
        res.writeHead(404); res.end(); return;
      }
      const startedAtMs = performance.now();
      const variant = activeVariant;
      const contents = await readFile(path.join(root, variant, offline.scenarioId, asset));
      const row = { variant, asset, startedAtMs, payloadBytes: contents.length, delivered: false };
      requests.push(row);
      res.on("finish", () => { row.delivered = true; });
      res.writeHead(200, { "Cache-Control": "no-store", "Content-Length": contents.length,
        "Content-Type": asset === "manifest.json" ? "application/json" : asset.startsWith("camera/") ? "image/jpeg" : "application/octet-stream" });
      res.end(contents);
    } else {
      const response = await fetch(new URL(req.url, upstream));
      res.writeHead(response.status, { "Content-Type": response.headers.get("content-type") ?? "application/octet-stream", "Cache-Control": "no-store" });
      if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
    }
  } catch (error) {
    res.writeHead(500); res.end("benchmark proxy failed");
    console.error(error.message);
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

function installDrawProbe() {
  window.__sweepDraw = { points: 0 };
  // range.value는 step=100 규칙으로 반올림된다. React가 대입한 원래 재생 시각을 보존한다.
  // 반올림된 값에 sync 차이를 더하면 실제 표시 timestamp가 흔들리는 것처럼 잘못 관찰된다.
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(HTMLInputElement.prototype, "value", { ...valueDescriptor,
    set(value) {
      if (this.type === "range") window.__sweepClock = Number(value);
      return valueDescriptor.set.call(this, value);
    },
  });
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const clear = prototype.clear, draw = prototype.drawArrays;
    prototype.clear = function(...args) { window.__sweepDraw.points = 0; return clear.apply(this, args); };
    prototype.drawArrays = function(mode, start, count) {
      if (mode === 0) window.__sweepDraw.points += count;
      return draw.call(this, mode, start, count);
    };
  }
  // 50ms는 비교용 주입이다. 제품 usePlayback의 100ms interval은 이 실험으로 변경되지 않는다.
  const setInterval = window.setInterval;
  window.setInterval = function(handler, ms, ...args) {
    return setInterval.call(this, handler, ms === 100 ? Number(new URLSearchParams(location.search).get("probeTick") ?? 100) : ms, ...args);
  };
}

function installDisplayMonitor(cameraFrames) {
  const panel = document.querySelector('[aria-labelledby="sync-title"]');
  const images = [...document.querySelectorAll('[aria-labelledby="camera-title"] img')];
  const out = window.__sweepDisplay = { samples: 0, cameraBlank: 0, lidarBlank: 0, cameraBackwards: 0,
    lidarBackwards: 0, domReplacements: 0, panelHeights: [], lidarTransitions: [], cameraTransitions: [],
    lidarLagMs: [], cameraLagMs: [], loadMeasurements: [], running: true };
  let lastLidar = null, lastCamera = null;
  const seenLoads = new Set();
  const sample = () => {
    if (!out.running) return;
    out.samples++;
    const time = window.__sweepClock;
    const rows = panel.querySelectorAll("dl>div");
    const difference = rows[1].querySelector("dd span span")?.textContent;
    const lidar = difference ? time + Number(difference.replaceAll(",", "").replace("ms", "")) : null;
    const active = images.find(image => image.dataset.active === "true");
    const camera = cameraFrames.find(frame => active?.src.endsWith("/" + frame.imageFile))?.timestampMs ?? null;
    for (const node of document.querySelectorAll("[data-measurement]")) {
      const measurement = JSON.parse(node.dataset.measurement);
      const id = `${measurement.timestampMs}:${measurement.startedAtMs}`;
      if (!seenLoads.has(id)) {
        seenLoads.add(id); out.loadMeasurements.push(measurement);
      }
    }
    if (lidar !== null) out.lidarLagMs.push(time-lidar);
    if (camera !== null) out.cameraLagMs.push(time-camera);
    if (!window.__sweepDraw.points) out.lidarBlank++;
    if (!active?.complete || !active.naturalWidth) out.cameraBlank++;
    if (lastLidar !== null && lidar < lastLidar) out.lidarBackwards++;
    if (lastCamera !== null && camera < lastCamera) out.cameraBackwards++;
    if (lidar !== null && lidar !== lastLidar) out.lidarTransitions.push({ timeMs: time, timestampMs: lidar, observedAtMs: performance.now() });
    if (camera !== null && camera !== lastCamera) out.cameraTransitions.push({ timeMs: time, timestampMs: camera, observedAtMs: performance.now() });
    lastLidar = lidar; lastCamera = camera;
    out.panelHeights.push(panel.getBoundingClientRect().height);
    if (images.some((image, index) => document.querySelectorAll('[aria-labelledby="camera-title"] img')[index] !== image)) out.domReplacements++;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

try {
  await withChromePage(async ({ send, evaluate, waitFor, exceptions }) => {
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installPerformanceProbe.toString()})(); (${installDrawProbe.toString()})()` });
    const viewport = { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false };
    await send("Emulation.setDeviceMetricsOverride", viewport);
    const trials = [];
    const configurations = [
      { variant: "keyframes", tickMs: 100 }, { variant: "individual", tickMs: 100 },
      { variant: "accumulated5", tickMs: 100 }, { variant: "individual", tickMs: 50 },
      { variant: "accumulated5", tickMs: 50 },
    ];
    const orders = [configurations, [...configurations].reverse(), [...configurations.slice(2), ...configurations.slice(0, 2)]];
    let environment;
    const startTimeMs = 1000;
    const metrics = () => evaluate(`(() => {
      const fields = Object.fromEntries([...document.querySelector('[aria-label="뷰어 통계"]').children].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
      return { fps: Number(fields.FPS), cache: fields['LiDAR 캐시'], pointCount: Number(fields['포인트 수'].replaceAll(',', '')),
        currentTimeMs: Number(document.querySelector('input[type=range]').value),
        current: JSON.parse(document.querySelector('[data-lidar-load-role="current"]')?.dataset.measurement ?? 'null') };
    })()`);
    for (const [round, order] of orders.entries()) {
      for (const configuration of order) {
        await send("Page.navigate", { url: "about:blank" });
        await delay(100);
        activeVariant = configuration.variant;
        const manifest = manifests[activeVariant];
        await send("Page.navigate", { url: `${origin}/viewer?probeTick=${configuration.tickMs}` });
        await waitFor(`document.querySelector('input[type=range]')?.max==='${manifest.durationMs}' && document.querySelector('img[data-active="true"]')?.naturalWidth>0`);
        await evaluate(`(() => { const input=document.querySelector('input[type=range]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'${startTimeMs}');
          input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
        const frame = manifest.lidar.frames.filter(f => f.timestampMs <= startTimeMs).at(-1);
        await waitFor(`window.__sweepDraw.points === ${frame.pointCount} && !document.querySelector('[aria-label="뷰어 통계"]').textContent.includes('로딩 중')`);
        await delay(1200);
        if (!environment) environment = await evaluate(`(() => { const gl=document.querySelector('canvas').getContext('webgl2'); const ext=gl.getExtension('WEBGL_debug_renderer_info');
          return {userAgent:navigator.userAgent, hardwareConcurrency:navigator.hardwareConcurrency, graphicsRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}; })()`);
        await evaluate(`(${installDisplayMonitor.toString()})(${JSON.stringify(manifest.camera.frames)})`);
        const startedAtMs = performance.now();
        await evaluate("window.__drivescopePerformance.start(); document.querySelector('button[aria-pressed]').click()");
        const playback = [];
        for (let i = 0; i < 5; i++) { await delay(1000); playback.push(await metrics()); }
        await evaluate("document.querySelector('button[aria-pressed]').click(); window.__sweepDisplay.running=false");
        const finishedAtMs = performance.now();
        const display = await evaluate("window.__sweepDisplay");
        display.loadMeasurements = display.loadMeasurements.filter(measurement=>measurement.startedAtMs >= display.lidarTransitions[0].observedAtMs);
        const mainThread = await evaluate("window.__drivescopePerformance.stop()");
        await delay(250);
        const network = requests.filter(row => row.startedAtMs >= startedAtMs && row.startedAtMs <= finishedAtMs);
        assert.ok(playback.at(-1).currentTimeMs >= 5900 && playback.at(-1).currentTimeMs < 7000);
        assert.equal(display.cameraBlank + display.lidarBlank + display.cameraBackwards + display.lidarBackwards + display.domReplacements, 0,
          JSON.stringify({cameraBlank:display.cameraBlank,lidarBlank:display.lidarBlank,cameraBackwards:display.cameraBackwards,lidarBackwards:display.lidarBackwards,domReplacements:display.domReplacements,lidarTransitions:display.lidarTransitions.slice(0,15)}));
        assert.equal(new Set(display.panelHeights).size, 1);
        const summarizeDisplay = transitions => ({ uniqueFrames: transitions.length,
          observedIntervalMs: summarize(transitions.slice(1).map((entry, index) => entry.observedAtMs-transitions[index].observedAtMs)) });
        const summarizeNetwork = prefix => { const matching=network.filter(row=>row.asset.startsWith(prefix)); return {
          requestCount: matching.length, uniqueAssets: new Set(matching.map(row=>row.asset)).size,
          requestedPayloadBytes: matching.reduce((total,row)=>total+row.payloadBytes,0),
          // server finishは socketへの送信完了。Chrome receipt/GPU完了の意味ではない。
          responseFinishedCount: matching.filter(row=>row.delivered).length,
        }; };
        const trial = { round: round+1, ...configuration, startedAtMs, finishedAtMs, playback,
          lidarDisplay: summarizeDisplay(display.lidarTransitions), cameraDisplay: summarizeDisplay(display.cameraTransitions),
          network: { lidar: summarizeNetwork("lidar/"), camera: summarizeNetwork("camera/") },
          display: { ...display, panelHeights:[...new Set(display.panelHeights)] }, mainThread };
        trials.push(trial);
        console.log(`round ${round+1} ${activeVariant} ${configuration.tickMs}ms: ${trial.lidarDisplay.uniqueFrames} LiDAR displays, ${trial.network.lidar.requestCount} requests, ${(trial.network.lidar.requestedPayloadBytes/1e6).toFixed(1)} MB`);
      }
    }
    assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
    const summaries = Object.fromEntries(configurations.map(configuration => {
      const matching = trials.filter(t=>t.variant===configuration.variant && t.tickMs===configuration.tickMs);
      return [`${configuration.variant}-${configuration.tickMs}ms`, {
        playbackFps: summarize(matching.flatMap(t=>t.playback.map(s=>s.fps))),
        lidarDisplayCount: summarize(matching.map(t=>t.lidarDisplay.uniqueFrames)),
        cameraDisplayCount: summarize(matching.map(t=>t.cameraDisplay.uniqueFrames)),
        lidarDisplayIntervalMs: summarize(matching.flatMap(t=>t.display.lidarTransitions.slice(1).map((entry,index)=>entry.observedAtMs-t.display.lidarTransitions[index].observedAtMs))),
        lidarLagMs: summarize(matching.flatMap(t=>t.display.lidarLagMs)), cameraLagMs: summarize(matching.flatMap(t=>t.display.cameraLagMs)),
        lidarRequestedPayloadBytes: summarize(matching.map(t=>t.network.lidar.requestedPayloadBytes)),
        lidarRequests: summarize(matching.map(t=>t.network.lidar.requestCount)),
        cameraRequestedPayloadBytes: summarize(matching.map(t=>t.network.camera.requestedPayloadBytes)),
        currentLoadDurationMs: summarize(matching.flatMap(t=>t.display.loadMeasurements.filter(m=>m.requestKind==="current").map(m=>m.loadDurationMs))),
        prefetchLoadDurationMs: summarize(matching.flatMap(t=>t.display.loadMeasurements.filter(m=>m.requestKind==="prefetch").map(m=>m.loadDurationMs))),
        mainThread: summarizeMainThread(matching.map(t=>t.mainThread)),
        blanksAndBackwards: matching.reduce((sum,t)=>sum+t.display.cameraBlank+t.display.lidarBlank+t.display.cameraBackwards+t.display.lidarBackwards,0),
        panelHeightPx: [...new Set(matching.flatMap(t=>t.display.panelHeights))],
      }];
    }));
    const result = { measuredAt:new Date().toISOString(), nodeVersion:process.version, platform:`${os.platform()} ${os.release()} ${os.arch()}`,
      environment, viewport, source:{scenarioId:offline.scenarioId,schemaVersion:3}, originalKeyframeHttpBytesEqual:true,
      protocol:{ orders, startTimeMs, playbackSecondsPerTrial:5, preparationMs:1200, httpCache:"disabled", osFileCache:"not reset",
        lidarLruCapacity:5, dataServer:"local same-origin readFile/no-store proxy; production UI unchanged",
        timingIntervention:"50ms configuration patches only 100ms setInterval in isolated browser; product stays 100ms",
        loadMeasurementScope:"unique UI-published current/prefetch measurements observed each rAF, started after playback monitor first sample; not every network request",
        percentile:"nearest-rank ceil(.95*N)", networkScope:"requests started during playback; payload bytes from server, excludes headers/manifest and startup/settling; not actual internet throughput",
        displayLagScope:"React-assigned range value captured before native step=100 sanitization, minus displayed timestamp; includes delivery delay but not sub-tick wall time", expectedNetwork:"unthrottled localhost" },
      summaries,trials,runtimeExceptionCount:exceptions.length };
    await writeFile(path.join(root,"browser.json"),JSON.stringify(result,null,2)+"\n");
    console.log(JSON.stringify(summaries,null,2));
  });
} finally {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
