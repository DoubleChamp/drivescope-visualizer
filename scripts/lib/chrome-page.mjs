import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 사용자 브라우저와 분리한 headless Chrome/CDP 세션. 종료 시 이 프로세스만 정리한다.
export async function withChromePage(run) {
  const chromePath = process.env.DRIVESCOPE_BENCHMARK_CHROME ??
    (process.platform === "win32" ? path.join(process.env.ProgramFiles ?? "C:/Program Files", "Google/Chrome/Application/chrome.exe") :
      process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "/usr/bin/google-chrome");
  await access(chromePath);
  const cache = path.resolve("node_modules/.cache/drivescope-benchmark");
  await mkdir(cache, { recursive: true });
  const profile = await mkdtemp(path.join(cache, "chrome-profile-"));
  const chrome = spawn(chromePath, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--enable-unsafe-swiftshader", `--user-data-dir=${profile}`, "about:blank"],
  { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let ws;
  const pending = new Map();
  try {
    const debuggerUrl = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Chrome 시작 시간 초과")), 20000);
      chrome.once("error", error => { clearTimeout(timer); reject(error); });
      chrome.once("exit", () => { clearTimeout(timer); reject(new Error("Chrome 종료")); });
      chrome.stderr.on("data", data => {
        output += data;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const targets = await (await fetch(`http://127.0.0.1:${new URL(debuggerUrl).port}/json/list`)).json();
    ws = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let commandId = 0;
    const exceptions = [];
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++commandId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method}: CDP 시간 초과`)); }, 25000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
      if (!message.id) return;
      const task = pending.get(message.id);
      if (!task) return;
      clearTimeout(task.timer);
      pending.delete(message.id);
      message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
    };
    const evaluate = async expression => {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const waitFor = async (expression, timeoutMs = 20000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await delay(50);
      }
      throw new Error(`대기 시간 초과: ${expression}`);
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    return await run({ send, evaluate, waitFor, exceptions });
  } finally {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error("Chrome 세션 종료")); }
    ws?.close();
    chrome.kill();
  }
}
