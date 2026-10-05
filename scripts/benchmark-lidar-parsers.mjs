import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { withChromePage, delay } from "./lib/chrome-page.mjs";
import { installPerformanceProbe } from "./lib/browser-performance-probe.mjs";
import { summarize, summarizeMainThread } from "./lib/performance-summary.mjs";

const baseUrl = new URL(process.env.DRIVESCOPE_BENCHMARK_URL ?? "http://localhost:3100");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname));
const response = await fetch(new URL("/api/drivescope-data/manifest.json", baseUrl));
assert.equal(response.status, 200);
const manifest = await response.json();
const seekTimesMs = [1000, 3000, 5000, 7000, 9000, 11000, 13000, 15000, 17000, 19000];
assert.ok(manifest.durationMs >= seekTimesMs.at(-1));
const viewport = { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false };
const playbackSamples = 10;
await withChromePage(async ({ send, evaluate, waitFor, exceptions }) => {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installPerformanceProbe.toString()})()` });
  await send("Emulation.setDeviceMetricsOverride", viewport);
  const metrics = () => evaluate(`(() => {
    const root = document.querySelector('[aria-label="뷰어 통계"]');
    const fields = Object.fromEntries([...root.children].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
    return {
      fps: Number(fields.FPS), pointCount: Number(fields['포인트 수'].replaceAll(',', '')),
      cache: fields['LiDAR 캐시'], currentTimeMs: Number(document.querySelector('input[type=range]').value),
      current: JSON.parse(document.querySelector('[data-lidar-load-role="current"]')?.dataset.measurement ?? 'null'),
      prefetch: [...document.querySelectorAll('[data-lidar-load-role="prefetch"]')].map(row => JSON.parse(row.dataset.measurement)),
    };
  })()`);
  const latestFrame = time => manifest.lidar.frames.filter(frame => frame.timestampMs <= time).at(-1);
  const seek = async time => {
    await evaluate(`(() => {
      const input = document.querySelector('input[type=range]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${time}');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    await waitFor(`document.querySelector('input[type=range]').value === '${time}' &&
      !document.querySelector('[aria-label="뷰어 통계"]').textContent.includes('로딩 중') &&
      Number(document.querySelector('[aria-label="뷰어 통계"] dd').textContent.replaceAll(',', '')) === ${latestFrame(time)?.pointCount ?? 0}`);
  };
  const trials = [];
  let environment;
  const orders = [["main", "worker"], ["worker", "main"], ["main", "worker"]];
  for (const [round, variants] of orders.entries()) {
    for (const variant of variants) {
      const url = new URL("/viewer", baseUrl);
      if (variant === "worker") url.searchParams.set("lidarParser", "worker");
      await send("Page.navigate", { url: url.href });
      await waitFor(`document.querySelector('input[type=range]')?.max === '${manifest.durationMs}' && document.querySelector('img[data-active="true"]')?.naturalWidth > 0`);
      assert.equal(await evaluate("!!document.querySelector('[role=alert]')"), false);
      if (!environment) environment = await evaluate(`(() => {
        const canvas = document.querySelector('canvas');
        const gl = canvas.getContext('webgl2');
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        return { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
          graphicsRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          canvasWidth: canvas.width, canvasHeight: canvas.height };
      })()`);
      assert.equal(await evaluate("window.__drivescopePerformance.start()"), true);
      const currentLoads = [];
      const prefetchLoads = [];
      for (const time of seekTimesMs) {
        await seek(time);
        const sample = await metrics();
        assert.ok(sample.cache.startsWith("miss"));
        assert.equal(sample.current?.requestKind, "current");
        assert.equal(sample.current.timestampMs, latestFrame(time).timestampMs);
        const timings = sample.current.timings;
        assert.ok(Object.values(timings).every(value => Number.isFinite(value) && value >= 0));
        assert.ok(timings.responseHeadersMs + timings.responseBodyMs + timings.preparePositionsMs <= sample.current.loadDurationMs + .01);
        assert.equal(typeof timings.workerComputeMs === "number", variant === "worker");
        const frameIndex = manifest.lidar.frames.indexOf(latestFrame(time));
        const neighbors = [manifest.lidar.frames[frameIndex - 1]?.timestampMs, manifest.lidar.frames[frameIndex + 1]?.timestampMs].filter(value => value !== undefined);
        await waitFor(`(() => {
          const samples = [...document.querySelectorAll('[data-lidar-load-role="prefetch"]')].map(row => JSON.parse(row.dataset.measurement));
          return ${JSON.stringify(neighbors)}.every(time => samples.some(sample => sample.timestampMs === time));
        })()`);
        const afterPrefetch = await metrics();
        assert.equal(afterPrefetch.current.startedAtMs, sample.current.startedAtMs);
        currentLoads.push({ targetTimeMs: time, pointCount: sample.pointCount, ...sample.current });
        prefetchLoads.push(...afterPrefetch.prefetch);
      }
      const lastTime = seekTimesMs.at(-1);
      const index = manifest.lidar.frames.indexOf(latestFrame(lastTime));
      await seek(Math.ceil(manifest.lidar.frames[index - 1].timestampMs / 100) * 100);
      await seek(lastTime);
      const hit = await metrics();
      assert.ok(hit.cache.startsWith("hit"));
      assert.equal(hit.current, null);
      const seekMainThread = await evaluate("window.__drivescopePerformance.stop()");
      await seek(0);
      await delay(2200);
      await evaluate("window.__drivescopePerformance.start()");
      await evaluate("document.querySelector('button[aria-pressed]').click()");
      const playback = [];
      for (let index = 0; index < playbackSamples; index++) {
        await delay(1000);
        const sample = await metrics();
        assert.ok(sample.fps > 0 && Number.isFinite(sample.fps));
        playback.push({ currentTimeMs: sample.currentTimeMs, fps: sample.fps, pointCount: sample.pointCount });
      }
      await evaluate("document.querySelector('button[aria-pressed]').click()");
      const playbackMainThread = await evaluate("window.__drivescopePerformance.stop()");
      assert.ok(playback.at(-1).currentTimeMs >= 9000 && playback.at(-1).currentTimeMs < 13000);
      trials.push({ round: round + 1, variant, currentLoads, prefetchLoads, playback, mainThread: { seek: seekMainThread, playback: playbackMainThread }, cacheHitPassed: true });
      console.log(`round ${round + 1} ${variant}: mean load ${summarize(currentLoads.map(sample => sample.loadDurationMs)).mean.toFixed(2)}ms; first prepare ${currentLoads[0].timings.preparePositionsMs.toFixed(2)}ms`);
    }
  }
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  const loadsSummary = samples => ({
    loadDurationMs: summarize(samples.map(sample => sample.loadDurationMs)),
    responseHeadersMs: summarize(samples.map(sample => sample.timings.responseHeadersMs)),
    responseBodyMs: summarize(samples.map(sample => sample.timings.responseBodyMs)),
    preparePositionsMs: summarize(samples.map(sample => sample.timings.preparePositionsMs)),
    workerComputeMs: summarize(samples.filter(sample => sample.timings.workerComputeMs !== undefined).map(sample => sample.timings.workerComputeMs)),
  });
  const summaries = Object.fromEntries(["main", "worker"].map(variant => {
    const matching = trials.filter(trial => trial.variant === variant);
    return [variant, {
      current: loadsSummary(matching.flatMap(trial => trial.currentLoads)),
      firstCurrentAfterNavigation: loadsSummary(matching.map(trial => trial.currentLoads[0])),
      warmCurrent: loadsSummary(matching.flatMap(trial => trial.currentLoads.slice(1))),
      prefetch: loadsSummary(matching.flatMap(trial => trial.prefetchLoads)),
      playbackFps: summarize(matching.flatMap(trial => trial.playback.map(sample => sample.fps))),
      mainThread: { seek: summarizeMainThread(matching.map(trial => trial.mainThread.seek)), playback: summarizeMainThread(matching.map(trial => trial.mainThread.playback)) },
      cacheHitChecksPassed: matching.filter(trial => trial.cacheHitPassed).length,
    }];
  }));
  const result = {
    measuredAt: new Date().toISOString(), nodeVersion: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    environment, viewport, source: { scenarioId: manifest.scenarioId, schemaVersion: manifest.schemaVersion, frameCount: manifest.lidar.frames.length },
    protocol: { orders, seekTimesMs, playbackSamplesPerTrial: playbackSamples, preparationMs: 2200,
      browserHttpCache: "disabled", osFileCache: "not reset", lidarLruCapacity: 5,
      percentile: "nearest-rank ceil(0.95 * N)", firstWorkerStartupIncludedInFirstCurrent: true,
      mainThreadTimerIntervalMs: 50, longTaskThresholdMs: 50 },
    summaries, trials, runtimeExceptionCount: exceptions.length,
  };
  await mkdir("node_modules/.cache/drivescope-benchmark", { recursive: true });
  await writeFile("node_modules/.cache/drivescope-benchmark/parsers-latest.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ summaries, result: "node_modules/.cache/drivescope-benchmark/parsers-latest.json" }, null, 2));
});
