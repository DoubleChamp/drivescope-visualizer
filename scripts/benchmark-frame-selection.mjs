import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { summarize } from "./lib/performance-summary.mjs";

const baseUrl = new URL(process.env.DRIVESCOPE_BENCHMARK_URL ?? "http://localhost:3100");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname));
const response = await fetch(new URL("/api/drivescope-data/manifest.json", baseUrl));
assert.equal(response.status, 200);
const manifest = await response.json();
const phase = process.env.DRIVESCOPE_SELECTION_PHASE ?? "after";
assert.ok(["before", "after"].includes(phase));
const require = createRequire(import.meta.url);
const modules = new Map();
function loadTs(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", output)(specifier => specifier.startsWith(".") ?
    loadTs(path.resolve(path.dirname(filename), `${specifier}.ts`)) : require(specifier), module, module.exports);
  return module.exports;
}
const { findLatestFrameAtOrBefore } = loadTs(path.resolve("app/viewer/_data/find-latest-frame-at-or-before.ts"));
const sourceText = readFileSync("app/viewer/_data/find-latest-frame-at-or-before.ts", "utf8");
if (phase === "before") assert.ok(sourceText.includes("for (const frame of frames)"), "before는 선형 탐색 구현을 바꾸기 전에만 실행합니다. 현재 버전은 after로 비교하세요.");
const createFrameSelector = phase === "after" ? loadTs(path.resolve("app/viewer/_data/frame-selector.ts")).createFrameSelector : null;
const streams = { lidar: manifest.lidar.frames, camera: manifest.camera.frames, ego: manifest.egoVehicle.frames };
const sequential = Array.from({ length: Math.floor(manifest.durationMs / 100) + 1 }, (_, index) => index * 100);
sequential.push(manifest.durationMs);
let seed = 12345;
const seeks = Array.from({ length: 193 }, () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return Math.floor(seed / 2 ** 32 * (manifest.durationMs + 1000)) - 1;
});
// 수정 전과 동일한 기준 함수. after 실행에서 같은 프로세스/자료로 다시 비교한다.
const linearReference = (frames, time) => {
  let latest = null;
  for (const frame of frames) if (frame.timestampMs <= time && (latest === null || frame.timestampMs > latest.timestampMs)) latest = frame;
  return latest;
};
const streamList = Object.values(streams);
const algorithms = phase === "before" ? { productionLinear: () => streamList.map(frames => time => findLatestFrameAtOrBefore(frames, time)) } : {
  linearReference: () => streamList.map(frames => time => linearReference(frames, time)),
  productionBinary: () => streamList.map(frames => time => findLatestFrameAtOrBefore(frames, time)),
  productionCursor: sequentialMode => streamList.map(frames => {
    const selector = createFrameSelector(frames);
    return time => selector.select(time, sequentialMode);
  }),
};
const repetitions = 4000;
const rounds = 5;
const samples = [];
for (const [workload, targets] of Object.entries({ sequential, seeks })) {
  const expectedChecksum = targets.reduce((sum, time) => sum + streamList.reduce((inner, frames) => inner + (linearReference(frames, time)?.timestampMs ?? -1), 0), 0);
  for (const [algorithm, create] of Object.entries(algorithms)) {
    const selectors = create(workload === "sequential");
    const run = repeats => {
      let checksum = 0;
      for (let repeat = 0; repeat < repeats; repeat++) for (const time of targets) for (const select of selectors) checksum += select(time)?.timestampMs ?? -1;
      return checksum;
    };
    assert.equal(run(1), expectedChecksum);
    run(100); // JIT warmup; index/cursor 생성은 측정 구간 밖이다.
    for (let round = 1; round <= rounds; round++) {
      const startedAt = performance.now();
      const checksum = run(repetitions);
      const elapsedMs = performance.now() - startedAt;
      assert.equal(checksum, expectedChecksum * repetitions);
      const selectionCount = repetitions * targets.length * streamList.length;
      samples.push({ workload, algorithm, round, elapsedMs, selectionCount, microsecondsPerSelection: elapsedMs * 1000 / selectionCount, checksum });
    }
  }
}
const summaries = Object.fromEntries(Object.keys({ sequential, seeks }).map(workload => [workload,
  Object.fromEntries(Object.keys(algorithms).map(algorithm => [algorithm, summarize(samples.filter(sample => sample.workload === workload && sample.algorithm === algorithm).map(sample => sample.microsecondsPerSelection))]))]));
const result = {
  measuredAt: new Date().toISOString(), phase, nodeVersion: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model,
  source: { scenarioId: manifest.scenarioId, schemaVersion: manifest.schemaVersion, streamCounts: Object.fromEntries(Object.entries(streams).map(([key, values]) => [key, values.length])),
    timestampsSha256: createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(streams).map(([key, values]) => [key, values.map(frame => frame.timestampMs)])))).digest("hex") },
  productionHelperSha256: createHash("sha256").update(sourceText).digest("hex"),
  protocol: { runtime: "Node.js isolated CPU microbenchmark; not browser FPS/UI latency", repetitions, rounds, warmupRepetitions: 100,
    timestampStepMs: 100, cursorConstructionExcluded: true, percentile: "nearest-rank of five run means, not individual selection P95", sequential, seeks },
  summaries, samples,
};
await mkdir("node_modules/.cache/drivescope-benchmark", { recursive: true });
const filename = `node_modules/.cache/drivescope-benchmark/frame-selection-${phase}.json`;
await writeFile(filename, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ summaries, result: filename }, null, 2));
