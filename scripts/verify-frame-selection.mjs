import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const modules = new Map();
function loadTs(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", output)(specifier => loadTs(path.resolve(path.dirname(filename), `${specifier}.ts`)), module, module.exports);
  return module.exports;
}
const { findLatestFrameAtOrBefore, findLatestFrameIndexAtOrBefore, findLatestIndexAtOrBefore } = loadTs(path.resolve("app/viewer/_data/find-latest-frame-at-or-before.ts"));
const { createFrameSelector } = loadTs(path.resolve("app/viewer/_data/frame-selector.ts"));
const linear = (frames, time) => {
  let selected = null;
  for (const frame of frames) if (frame.timestampMs <= time && (!selected || frame.timestampMs > selected.timestampMs)) selected = frame;
  return selected;
};
let comparisons = 0;
function verify(frames, targets) {
  const selector = createFrameSelector(frames);
  for (const [index, time] of targets.entries()) {
    const expected = linear(frames, time);
    assert.equal(findLatestFrameAtOrBefore(frames, time), expected);
    assert.equal(selector.select(time, index % 3 !== 0), expected);
    assert.equal(selector.select(time, true), expected, "반복 렌더에서 같은 참조");
    assert.equal(findLatestFrameIndexAtOrBefore(frames, time), expected ? frames.indexOf(expected) : -1);
    comparisons++;
  }
}
const specialTimes = [-Infinity, -1, 0, 1, 9, 10, 11, 19, 20, 100, Infinity, NaN, 0, 100, 10, 9, 0];
for (const values of [[], [10], [0, 0, 10, 10, 20, 20]]) verify(values.map((timestampMs, id) => ({ timestampMs, id })), specialTimes);
let seed = 42;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const generated = Array.from({ length: 500 }, (_, id) => ({ timestampMs: Math.floor(random() * 1000), id })).toSorted((a, b) => a.timestampMs - b.timestampMs);
verify(generated, Array.from({ length: 2000 }, () => Math.floor(random() * 1100) - 50));
verify(generated, [...Array.from({ length: 1100 }, (_, time) => time - 50), 0, 500, 1000, 0]);
const { mockScenario } = loadTs(path.resolve("app/viewer/_data/mock-scenario.ts"));
for (const key of ["cameraFrames", "lidarFrames", "objectDetectionFrames", "vehicleStateFrames", "trajectoryFrames"]) {
  verify(mockScenario[key], Array.from({ length: 151 }, (_, index) => index * 100));
}
const original = [{ timestampMs: 10, id: "old" }];
const next = [{ timestampMs: 10, id: "new" }];
assert.equal(createFrameSelector(original).select(10, true), original[0]);
assert.equal(createFrameSelector(next).select(10, true), next[0], "소스마다 별도 snapshot/cursor");
const { loadMockLidarFrame } = loadTs(path.resolve("app/viewer/_data/load-mock-lidar-frame.ts"));
const mockFrame = mockScenario.lidarFrames[0];
assert.equal(await loadMockLidarFrame(mockScenario.lidarFrames, -1), null);
assert.equal(await loadMockLidarFrame(mockScenario.lidarFrames, mockFrame.timestampMs + 1), null, "정확한 timestamp가 아니면 로딩하지 않음");
const loadedMock = await loadMockLidarFrame(mockScenario.lidarFrames, mockFrame.timestampMs);
assert.notEqual(loadedMock.positions.buffer, mockFrame.positions.buffer);
assert.deepEqual(loadedMock.positions, mockFrame.positions);
for (const duplicate of [false, true]) {
  const timestamps = Array.from({ length: 100_000 }, (_, index) => duplicate ? 10 : index);
  let reads = 0;
  const index = findLatestIndexAtOrBefore(timestamps, Infinity, value => { reads++; return value; });
  assert.equal(index, duplicate ? 0 : timestamps.length - 1);
  assert.ok(reads <= 2 * Math.ceil(Math.log2(timestamps.length)) + 2, `이진 탐색 읽기 수 ${reads}`);
}
console.log(`PASS ${comparisons}개 선택 비교: 경계·중복 첫 항목·NaN/무한·순차·정지/seek·역행·가상 5종·소스 초기화·100,000개 이진 탐색 상한`);
