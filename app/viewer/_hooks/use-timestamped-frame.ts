import { useMemo } from "react";
import type { TimestampedFrame } from "../_data/find-latest-frame-at-or-before";
import { createFrameSelector } from "../_data/frame-selector";

export function useTimestampedFrame<T extends TimestampedFrame>(
  frames: readonly T[],
  currentTimeMs: number,
  isPlaying: boolean,
) {
  const selector = useMemo(() => createFrameSelector(frames), [frames]);
  // cursor는 탐색 캐시일 뿐이다. 뒤로 간 시각/seek는 이진 탐색하므로 렌더 순서와 무관한 결과다.
  return selector.select(currentTimeMs, isPlaying);
}
