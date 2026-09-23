import { useEffect, useState } from "react";
import { FrameCache } from "../_data/frame-cache";
import type { LidarFrame } from "../_data/frame-types";
import { loadMockLidarFrame } from "../_data/load-mock-lidar-frame";

export type LidarCacheStatus = "empty" | "loading" | "hit" | "miss";

type CachedFrameState = {
  timestampMs: number | null;
  frame: LidarFrame | null;
  status: LidarCacheStatus;
  entryCount: number;
};

type UseLidarFrameCacheOptions = {
  sourceFrames: readonly LidarFrame[];
  targetTimestampMs: number | null;
};

export function useLidarFrameCache({
  sourceFrames,
  targetTimestampMs,
}: UseLidarFrameCacheOptions) {
  // Map 변경은 화면 자체가 아니므로 React state가 아닌 장기 생존 객체에 보관한다.
  const [cache] = useState(() => new FrameCache<LidarFrame>());
  const [state, setState] = useState<CachedFrameState>({
    timestampMs: null,
    frame: null,
    status: "empty",
    entryCount: 0,
  });

  useEffect(() => {
    let ignoreResult = false;

    if (targetTimestampMs === null) {
      setState({
        timestampMs: null,
        frame: null,
        status: "empty",
        entryCount: cache.size,
      });
      return;
    }

    const cachedFrame = cache.get(targetTimestampMs);
    if (cachedFrame) {
      setState({
        timestampMs: targetTimestampMs,
        frame: cachedFrame,
        status: "hit",
        entryCount: cache.size,
      });
      return;
    }

    setState({
      timestampMs: targetTimestampMs,
      frame: null,
      status: "loading",
      entryCount: cache.size,
    });

    void loadMockLidarFrame(sourceFrames, targetTimestampMs).then((frame) => {
      if (frame) cache.set(frame);
      if (ignoreResult) return;

      setState({
        timestampMs: targetTimestampMs,
        frame,
        status: "miss",
        entryCount: cache.size,
      });
    });

    // 빠른 seek로 목표가 바뀌면 이전 요청이 늦게 끝나도 현재 화면을 덮어쓰지 않는다.
    return () => {
      ignoreResult = true;
    };
  }, [cache, sourceFrames, targetTimestampMs]);

  useEffect(
    () => () => {
      // 컴포넌트가 사라질 때 Frame과 Float32Array 참조를 끊어 GC 대상이 되게 한다.
      cache.clear();
    },
    [cache],
  );

  const stateMatchesTarget = state.timestampMs === targetTimestampMs;

  return {
    frame: stateMatchesTarget ? state.frame : null,
    status:
      targetTimestampMs === null
        ? "empty"
        : stateMatchesTarget
          ? state.status
          : "loading",
    entryCount: state.entryCount,
  };
}
