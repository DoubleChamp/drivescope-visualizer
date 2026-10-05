// CDP가 새 document에 주입하는 측정기. 제품 코드·React state에 이력을 넣지 않는다.
export function installPerformanceProbe() {
  let sample = null;
  let timerId;
  let rafId;
  let previousFrame;
  const appendTasks = entries => {
    if (!sample) return;
    for (const entry of entries) {
      if (entry.startTime >= sample.startedAtMs) {
        sample.longTasks.push({ startedAtMs: entry.startTime, durationMs: entry.duration });
      }
    }
  };
  const supported = PerformanceObserver.supportedEntryTypes.includes("longtask");
  const observer = supported ? new PerformanceObserver(list => appendTasks(list.getEntries())) : null;
  observer?.observe({ type: "longtask" });
  window.__drivescopePerformance = {
    start() {
      if (sample) throw new Error("측정 구간이 겹칩니다.");
      observer?.takeRecords();
      sample = { startedAtMs: performance.now(), longTasks: [], timerLatenessMs: [], animationFrameGapMs: [] };
      const scheduleTimer = () => {
        const dueAt = performance.now() + 50;
        timerId = setTimeout(() => {
          if (!sample) return;
          sample.timerLatenessMs.push(Math.max(0, performance.now() - dueAt));
          scheduleTimer();
        }, 50);
      };
      const frame = time => {
        if (!sample) return;
        if (previousFrame !== undefined) sample.animationFrameGapMs.push(time - previousFrame);
        previousFrame = time;
        rafId = requestAnimationFrame(frame);
      };
      previousFrame = undefined;
      scheduleTimer();
      rafId = requestAnimationFrame(frame);
      return supported;
    },
    stop() {
      appendTasks(observer?.takeRecords() ?? []);
      clearTimeout(timerId);
      cancelAnimationFrame(rafId);
      const result = { ...sample, durationMs: performance.now() - sample.startedAtMs, longTaskSupported: supported };
      sample = null;
      return result;
    },
  };
}
