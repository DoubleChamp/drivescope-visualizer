import { useEffect, useState } from "react";
import { FrameCache } from "../_data/frame-cache";
import type { LidarFrame } from "../_data/frame-types";
import { loadMockLidarFrame } from "../_data/load-mock-lidar-frame";

const LIDAR_FRAME_CACHE_CAPACITY = 5;

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
  const [cache] = useState(
    () => new FrameCache<LidarFrame>(LIDAR_FRAME_CACHE_CAPACITY),
  );
  // 완료되기 전 요청도 timestamp별로 공유해 현재 로딩과 prefetch가 중복되지 않게 한다.
  const [inFlightLoads] = useState(
    () => new Map<number, Promise<LidarFrame | null>>(),
  );
  const [state, setState] = useState<CachedFrameState>({
    timestampMs: null,
    frame: null,
    status: "empty",
    entryCount: 0,
  });

  useEffect(() => {
    let ignoreResult = false;

    const getOrLoadFrame = (timestampMs: number) => {
      const cachedFrame = cache.get(timestampMs);
      if (cachedFrame) return Promise.resolve(cachedFrame);

      const inFlightLoad = inFlightLoads.get(timestampMs);
      if (inFlightLoad) return inFlightLoad;

      const load = loadMockLidarFrame(sourceFrames, timestampMs)
        .then((frame) => {
          if (frame) cache.set(frame);
          return frame;
        })
        .finally(() => {
          inFlightLoads.delete(timestampMs);
        });

      inFlightLoads.set(timestampMs, load);
      return load;
    };

    const prefetchNeighborFrames = async () => {
      const targetIndex = sourceFrames.findIndex(
        (frame) => frame.timestampMs === targetTimestampMs,
      );
      if (targetIndex === -1) return;

      const neighborTimestamps = [
        sourceFrames[targetIndex - 1]?.timestampMs,
        sourceFrames[targetIndex + 1]?.timestampMs,
      ].filter(
        (timestampMs): timestampMs is number => timestampMs !== undefined,
      );

      await Promise.all(
        neighborTimestamps.map((timestampMs) => getOrLoadFrame(timestampMs)),
      );
      if (ignoreResult) return;

      // prefetch는 현재 Frame과 hit·miss 판정을 건드리지 않고 캐시 개수만 갱신한다.
      setState((currentState) => ({
        ...currentState,
        entryCount: cache.size,
      }));
    };

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
      void prefetchNeighborFrames();

      return () => {
        ignoreResult = true;
      };
    }

    setState({
      timestampMs: targetTimestampMs,
      frame: null,
      status: "loading",
      entryCount: cache.size,
    });

    void getOrLoadFrame(targetTimestampMs).then((frame) => {
      if (ignoreResult) return;

      setState({
        timestampMs: targetTimestampMs,
        frame,
        status: "miss",
        entryCount: cache.size,
      });
      void prefetchNeighborFrames();
    });

    // 빠른 seek로 목표가 바뀌면 이전 요청이 늦게 끝나도 현재 화면을 덮어쓰지 않는다.
    return () => {
      ignoreResult = true;
    };
  }, [cache, inFlightLoads, sourceFrames, targetTimestampMs]);

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
    capacity: cache.capacity,
  };
}
