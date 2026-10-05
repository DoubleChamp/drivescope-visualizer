import assert from "node:assert/strict";
import { withChromePage } from "./lib/chrome-page.mjs";

const baseUrl = new URL(process.env.DRIVESCOPE_BENCHMARK_URL ?? "http://localhost:3100");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname));
const manifest = await (await fetch(new URL("/api/drivescope-data/manifest.json", baseUrl))).json();
await withChromePage(async ({ send, evaluate, waitFor, exceptions }) => {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `(${function () {
    const NativeWorker = window.Worker;
    window.__workerCheck = { created: 0, terminated: 0, sent: 0, detached: 0, returned: 0, mismatches: 0, inFlight: 0 };
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.checkRequests = new Map();
        window.__workerCheck.created++;
        this.addEventListener("message", event => {
          const result = event.data;
          const expected = this.checkRequests.get(result.id);
          if (!expected) return;
          this.checkRequests.delete(result.id);
          window.__workerCheck.inFlight--;
          window.__workerCheck.returned++;
          const actual = result.ok ? new Uint8Array(result.positions.buffer) : null;
          if (!actual || actual.length !== expected.length || actual.some((byte, index) => byte !== expected[index])) {
            window.__workerCheck.mismatches++;
          }
        });
      }
      postMessage(message, transfer) {
        if (message?.buffer instanceof ArrayBuffer) {
          this.checkRequests.set(message.id, new Uint8Array(message.buffer.slice(0)));
          window.__workerCheck.sent++;
          window.__workerCheck.inFlight++;
          super.postMessage(message, transfer);
          if (message.buffer.byteLength === 0) window.__workerCheck.detached++;
        } else super.postMessage(message, transfer);
      }
      terminate() {
        window.__workerCheck.terminated++;
        window.__workerCheck.inFlight -= this.checkRequests.size;
        this.checkRequests.clear();
        return super.terminate();
      }
    };
  }.toString()})()` });
  const ready = `document.querySelector('input[type=range]')?.max === '${manifest.durationMs}' && document.querySelector('img[data-active="true"]')?.naturalWidth > 0`;
  await send("Page.navigate", { url: new URL("/viewer", baseUrl).href });
  await waitFor(ready);
  await evaluate(`document.querySelector('input[type=range]').value`);
  assert.equal((await evaluate("window.__workerCheck")).created, 0, "기본 경로는 Worker를 만들지 않습니다.");
  await send("Page.navigate", { url: new URL("/viewer?lidarParser=worker", baseUrl).href });
  await waitFor(ready);
  const seek = async time => {
    await evaluate(`(() => {
      const input = document.querySelector('input[type=range]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${time}');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    if (time > 0) await waitFor(`document.querySelector('[data-lidar-load-role="current"]')?.dataset.measurement &&
      !document.querySelector('[aria-label="뷰어 통계"]').textContent.includes('로딩 중') && window.__workerCheck.inFlight === 0`);
  };
  for (const time of [1000, 5000, 12400, 19000, 5000]) await seek(time);
  const result = await evaluate("window.__workerCheck");
  assert.equal(result.created, 1);
  assert.ok(result.sent >= 10);
  assert.equal(result.sent, result.detached, "전달한 입력 buffer는 소유권 이전 뒤 detached여야 합니다.");
  assert.equal(result.returned, result.sent);
  assert.equal(result.mismatches, 0, "돌아온 모든 좌표 byte가 원본과 같아야 합니다.");
  await evaluate(`document.querySelector('input[name="viewer-mode"][value="mock"]').click()`);
  await waitFor(`document.querySelector('input[type=range]')?.max === '15000'`);
  assert.equal((await evaluate("window.__workerCheck")).terminated, 1);
  await evaluate(`document.querySelector('input[name="viewer-mode"][value="actual"]').click()`);
  await waitFor(ready);
  await seek(1000);
  assert.equal((await evaluate("window.__workerCheck")).created, 2);
  // far seek 후 바로 mode 변경: 진행 중 HTTP/Worker 결과를 새 세션에 쓰지 않는다.
  await evaluate(`(() => {
    const input = document.querySelector('input[type=range]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '12400');
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await evaluate(`document.querySelector('input[name="viewer-mode"][value="mock"]').click()`);
  await waitFor(`document.querySelector('input[type=range]')?.max === '15000' && window.__workerCheck.terminated === 2`);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log(JSON.stringify({ result, final: await evaluate("window.__workerCheck"), runtimeExceptions: exceptions.length }, null, 2));
  console.log("PASS production Worker: 기본 미생성·transfer/detach·전체 byte 일치·seek·종료·재진입·늦은 결과 차단");
});
