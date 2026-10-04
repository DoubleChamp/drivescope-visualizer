import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// 브라우저용 TS 로더를 메모리에서 실행한다. 실제 네트워크·개인 데이터는 사용하지 않는다.
const require = createRequire(import.meta.url);
const modules = new Map();
function loadTypeScript(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = specifier => specifier.startsWith(".")
    ? loadTypeScript(path.resolve(path.dirname(filename), `${specifier}.ts`))
    : require(specifier);
  new Function("require", "module", "exports", outputText)(localRequire, module, module.exports);
  return module.exports;
}

const { loadDriveScopeDataSource } = loadTypeScript(path.resolve("app/viewer/_data/load-drivescope-data-source.ts"));
const manifest = JSON.parse(readFileSync("fixtures/drivescope-manifest.json", "utf8"));
const metadata = manifest.lidar.frames[0];
const bytes = new Float32Array(metadata.pointCount * 3);
bytes[0] = 1.25;
bytes[1] = -2.5;
const originalFetch = globalThis.fetch;
const originalPerformance = globalThis.performance;
let clock = 0;
let status = 200;
let buffer = bytes.buffer;
let frameRequests = 0;
try {
  // 구간별 시간을 정확히 다르게 주어 fetch 대기와 본문 대기가 섞이지 않는지 검증한다.
  globalThis.performance = { now: () => clock };
  globalThis.fetch = async input => {
    const url = new URL(input);
    if (url.pathname.endsWith("manifest.json")) {
      return { ok: true, url: url.href, json: async () => manifest };
    }
    frameRequests++;
    clock += 40;
    return {
      ok: status === 200, status,
      arrayBuffer: async () => { clock += 70; return buffer; },
    };
  };
  const source = await loadDriveScopeDataSource("https://example.test/scene/manifest.json");
  const result = await source.loadFrame(metadata.timestampMs);
  assert.deepEqual(result.timings, { responseHeadersMs: 40, responseBodyMs: 70, preparePositionsMs: 0 });
  assert.equal(result.frame.positions[0], 1.25);
  assert.equal(result.frame.positions[1], -2.5);
  assert.equal(result.frame.positions.length, metadata.pointCount * 3);
  assert.equal(result.frame.positions.buffer, buffer, "little-endian은 바이너리를 복사하지 않습니다.");
  const beforeMissing = frameRequests;
  assert.deepEqual(await source.loadFrame(-1), { frame: null, timings: null });
  assert.equal(frameRequests, beforeMissing, "없는 timestamp는 HTTP 요청을 만들지 않습니다.");
  status = 404;
  await assert.rejects(source.loadFrame(metadata.timestampMs), /HTTP 404/);
  status = 200;
  buffer = new ArrayBuffer(bytes.byteLength - 4);
  await assert.rejects(source.loadFrame(metadata.timestampMs), /크기가 예상과 다릅니다/);
  console.log("PASS 로더 4개 검사: 구간 분리·좌표 보존, 미존재 Frame, HTTP 실패, 잘린 바이너리");
} finally {
  globalThis.fetch = originalFetch;
  globalThis.performance = originalPerformance;
}
