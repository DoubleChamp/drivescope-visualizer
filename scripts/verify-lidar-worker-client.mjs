import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker as NodeWorker } from "node:worker_threads";
import ts from "typescript";

const compile = (filename, module = ts.ModuleKind.CommonJS) => ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module, target: ts.ScriptTarget.ES2022 },
}).outputText;
const filename = path.resolve("app/viewer/_workers/lidar-positions-worker-client.ts");
// 테스트에서 import.meta의 기준만 실제 소스 파일 URL로 고정한다.
const code = compile(filename, ts.ModuleKind.ESNext).replaceAll("import.meta.url", JSON.stringify(pathToFileURL(filename).href));
const { createLidarPositionsWorker } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const originals = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const workers = [];
const timers = new Map();
let nextTimer = 0;
class TestWorker extends EventTarget {
  constructor() { super(); this.requests = []; this.terminated = false; workers.push(this); }
  postMessage(request, transfer) { this.requests.push(structuredClone(request, { transfer })); }
  terminate() { this.terminated = true; }
  reply(request, error) {
    const response = error ? { id: request.id, ok: false, error } :
      { id: request.id, ok: true, positions: new Float32Array(request.buffer), workerComputeMs: .1 };
    this.dispatchEvent(new MessageEvent("message", { data: response }));
  }
}
try {
  globalThis.Worker = TestWorker;
  globalThis.setTimeout = callback => { const id = ++nextTimer; timers.set(id, callback); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  const client = createLidarPositionsWorker();
  assert.equal(workers.length, 0, "지연 생성");
  const input = new Float32Array([1, 2, 3]);
  const first = client.parse(input.buffer, 1);
  const second = client.parse(new Float32Array([4, 5, 6]).buffer, 1);
  assert.equal(input.byteLength, 0, "입력 detached");
  assert.equal(workers.length, 1, "요청마다 Worker를 만들지 않음");
  workers[0].reply(workers[0].requests[1]);
  workers[0].reply(workers[0].requests[0]);
  assert.deepEqual([...((await first).positions)], [1, 2, 3]);
  assert.deepEqual([...((await second).positions)], [4, 5, 6]);
  const invalid = client.parse(new ArrayBuffer(4), 1);
  const invalidCheck = assert.rejects(invalid, /invalid size/);
  workers[0].reply(workers[0].requests.at(-1), "invalid size");
  await invalidCheck;
  const pending = client.parse(new ArrayBuffer(12), 1);
  const pendingCheck = assert.rejects(pending, /세션이 종료/);
  client.dispose();
  await pendingCheck;
  assert.equal(workers[0].terminated, true);
  assert.equal(timers.size, 0);
  await assert.rejects(client.parse(new ArrayBuffer(12), 1), /세션이 종료/);
  const retryClient = createLidarPositionsWorker();
  for (const eventType of ["error", "messageerror"]) {
    const request = retryClient.parse(new ArrayBuffer(12), 1);
    const check = assert.rejects(request);
    workers.at(-1).dispatchEvent(new Event(eventType));
    await check;
    assert.equal(workers.at(-1).terminated, true);
    assert.equal(timers.size, 0);
  }
  const timed = retryClient.parse(new ArrayBuffer(12), 1);
  const timedCheck = assert.rejects(timed, /시간이 초과/);
  [...timers.values()][0]();
  await timedCheck;
  const recovered = retryClient.parse(new Float32Array([7, 8, 9]).buffer, 1);
  workers.at(-2).dispatchEvent(new Event("error"));
  assert.equal(workers.at(-1).terminated, false, "종료된 Worker의 늦은 오류는 새 Worker를 종료하지 않음");
  workers.at(-1).reply(workers.at(-1).requests[0]);
  assert.equal((await recovered).positions[0], 7);
  retryClient.dispose();
  assert.equal(timers.size, 0);
  console.log("PASS Worker client: 동시/역순 ID·detach·오류·timeout·종료·재시도·timer 정리");
} finally {
  Object.assign(globalThis, originals);
}

// 실제 Worker 본문의 transfer를 Node worker_threads로 확인한다. 브라우저 bundle은 별도 검사한다.
const worker = new NodeWorker(`
  const { parentPort, workerData } = require('node:worker_threads');
  const prepared = { exports: {} };
  new Function('module','exports',workerData.prepare)(prepared, prepared.exports);
  globalThis.self = {
    postMessage(message, transfer = []) {
      parentPort.postMessage(message, transfer);
      parentPort.postMessage({ transferredByteLengths: transfer.map(buffer => buffer.byteLength) });
    }
  };
  const runtime = { exports: {} };
  new Function('require','module','exports',workerData.worker)(() => prepared.exports, runtime, runtime.exports);
  parentPort.on('message', data => self.onmessage({ data }));
`, { eval: true, workerData: {
  prepare: compile("app/viewer/_data/prepare-lidar-positions.ts"),
  worker: compile("app/viewer/_workers/lidar-positions.worker.ts"),
} });
try {
  const responses = [];
  worker.on("message", data => responses.push(data));
  const buffer = new Float32Array([1.25, -2.5, 3.75]).buffer;
  worker.postMessage({ id: 1, buffer, pointCount: 1 }, [buffer]);
  assert.equal(buffer.byteLength, 0);
  const waitFor = async count => {
    const deadline = Date.now() + 5000;
    while (responses.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(responses.length, count);
  };
  await waitFor(2);
  assert.deepEqual([...responses[0].positions], [1.25, -2.5, 3.75]);
  assert.deepEqual(responses[1].transferredByteLengths, [0], "Worker가 돌려보낸 buffer도 detached");
  worker.postMessage({ id: 2, buffer: new ArrayBuffer(4), pointCount: 1 });
  await waitFor(4);
  assert.equal(responses[2].ok, false);
  assert.match(responses[2].error, /크기가 예상과 다릅니다/);
  console.log("PASS Worker 본문: 양방향 실제 transfer·좌표 일치·잘린 입력 거부");
} finally {
  await worker.terminate();
}
