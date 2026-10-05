export type TimestampedFrame = {
  timestampMs: number;
};

// 오름차순 데이터 계약을 사용한다. 같은 timestamp가 반복되면 기존 함수처럼 첫 Frame을 반환한다.
export function findLatestIndexAtOrBefore<T>(
  values: ArrayLike<T>,
  targetTimeMs: number,
  getTimestamp: (value: T) => number,
): number {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (getTimestamp(values[middle]) <= targetTimeMs) left = middle + 1;
    else right = middle;
  }
  if (left === 0) return -1;

  const latestTimestamp = getTimestamp(values[left - 1]);
  right = left - 1;
  left = 0;
  // 최신 timestamp 그룹의 첫 항목을 찾는다. 중복이 많아도 선형으로 되돌아가지 않는다.
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (getTimestamp(values[middle]) < latestTimestamp) left = middle + 1;
    else right = middle;
  }
  return left;
}

const frameTimestamp = (frame: TimestampedFrame) => frame.timestampMs;

export const findLatestFrameIndexAtOrBefore = (
  frames: readonly TimestampedFrame[],
  targetTimeMs: number,
) => findLatestIndexAtOrBefore(frames, targetTimeMs, frameTimestamp);

export const findLatestFrameAtOrBefore = <T extends TimestampedFrame>(
  frames: readonly T[],
  targetTimeMs: number,
): T | null => {
  const index = findLatestFrameIndexAtOrBefore(frames, targetTimeMs);
  return index === -1 ? null : frames[index];
};
