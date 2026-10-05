import { findLatestIndexAtOrBefore, type TimestampedFrame } from "./find-latest-frame-at-or-before";

const timestampValue = (value: number) => value;

// 정렬된 불변 Frame 목록마다 한 번 생성한다. timestamp snapshot·cursor는 React state가 아니다.
export function createFrameSelector<T extends TimestampedFrame>(frames: readonly T[]) {
  const timestamps = frames.map(frame => frame.timestampMs);
  let scannedIndex = -1;
  let selectedIndex = -1;
  let previousTimeMs: number | null = null;

  return {
    select(targetTimeMs: number, sequential = false): T | null {
      if (targetTimeMs === previousTimeMs) return selectedIndex === -1 ? null : frames[selectedIndex];
      if (!sequential || previousTimeMs === null || targetTimeMs < previousTimeMs || Number.isNaN(targetTimeMs)) {
        selectedIndex = findLatestIndexAtOrBefore(timestamps, targetTimeMs, timestampValue);
        scannedIndex = selectedIndex;
      } else {
        while (scannedIndex + 1 < timestamps.length && timestamps[scannedIndex + 1] <= targetTimeMs) {
          scannedIndex += 1;
          if (selectedIndex === -1 || timestamps[scannedIndex] > timestamps[selectedIndex]) selectedIndex = scannedIndex;
        }
      }
      previousTimeMs = Number.isNaN(targetTimeMs) ? null : targetTimeMs;
      return selectedIndex === -1 ? null : frames[selectedIndex];
    },
  };
}
