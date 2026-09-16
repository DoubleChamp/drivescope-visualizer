type TimestampedFrame = {
  timestampMs: number;
};

export const findLatestFrameAtOrBefore = <T extends TimestampedFrame>(
  frames: readonly T[],
  targetTimeMs: number,
): T | null => {
  let latestFrame: T | null = null;

  // TODO: 실제 데이터에서 탐색 비용이 병목으로 측정되면 정렬된 배열의 이진 탐색을 검토한다.
  for (const frame of frames) {
    if (
      frame.timestampMs <= targetTimeMs &&
      (latestFrame === null || frame.timestampMs > latestFrame.timestampMs)
    ) {
      latestFrame = frame;
    }
  }

  return latestFrame;
};
