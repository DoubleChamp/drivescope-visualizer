type TimestampedFrame = {
  timestampMs: number;
};

export const findNearestFrame = <T extends TimestampedFrame>(
  frames: readonly T[],
  targetTimeMs: number,
): T | null => {
  let nearestFrame: T | null = null;
  let nearestDistanceMs = Number.POSITIVE_INFINITY;

  for (const frame of frames) {
    const distanceMs = Math.abs(frame.timestampMs - targetTimeMs);

    if (
      distanceMs < nearestDistanceMs ||
      (distanceMs === nearestDistanceMs &&
        nearestFrame !== null &&
        frame.timestampMs < nearestFrame.timestampMs)
    ) {
      nearestFrame = frame;
      nearestDistanceMs = distanceMs;
    }
  }

  return nearestFrame;
};
