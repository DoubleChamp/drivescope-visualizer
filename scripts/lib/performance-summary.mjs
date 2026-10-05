// nearest-rank P95: 정렬된 N개 중 ceil(0.95 * N)번째 표본.
export function summarize(values) {
  if (values.length === 0) return { count: 0, min: null, mean: null, median: null, p95: null, max: null };
  const sorted = values.toSorted((a, b) => a - b);
  const middle = sorted.length / 2;
  return {
    count: sorted.length, min: sorted[0],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1),
  };
}

export function summarizeMainThread(samples) {
  const tasks = samples.flatMap(sample => sample.longTasks);
  return {
    observationDurationMs: samples.reduce((sum, sample) => sum + sample.durationMs, 0),
    longTaskCount: tasks.length,
    longTaskDurationMs: summarize(tasks.map(task => task.durationMs)),
    totalLongTaskDurationMs: tasks.reduce((sum, task) => sum + task.durationMs, 0),
    totalBlockingExcess50Ms: tasks.reduce((sum, task) => sum + Math.max(0, task.durationMs - 50), 0),
    timerLatenessMs: summarize(samples.flatMap(sample => sample.timerLatenessMs)),
    animationFrameGapMs: summarize(samples.flatMap(sample => sample.animationFrameGapMs)),
  };
}
