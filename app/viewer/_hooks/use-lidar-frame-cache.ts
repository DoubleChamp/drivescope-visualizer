import { useEffect, useMemo, useState } from "react";
import { FrameCache } from "../_data/frame-cache";
import type { LidarFrame } from "../_data/frame-types";

const LIDAR_FRAME_CACHE_CAPACITY = 5;

export type LidarCacheStatus = "empty" | "loading" | "hit" | "miss" | "error";

type CachedFrameState = {
  source: LidarFrameSource;
  timestampMs: number | null;
  frame: LidarFrame | null;
  status: LidarCacheStatus;
  entryCount: number;
  loadDurationMs: number | null;
  error: Error | null;
};

type LidarFrameLoadResult = {
  frame: LidarFrame | null;
  loadDurationMs: number | null;
};

export type LidarFrameSource = {
  id: string;
  frames: readonly { timestampMs: number }[];
  loadFrame: (timestampMs: number) => Promise<LidarFrame | null>;
};

type UseLidarFrameCacheOptions = {
  source: LidarFrameSource;
  targetTimestampMs: number | null;
};

export function useLidarFrameCache({
  source,
  targetTimestampMs,
}: UseLidarFrameCacheOptions) {
  const [requestAttempt, setRequestAttempt] = useState(0);
  // Map 변경은 화면 자체가 아니므로 React state가 아닌 장기 생존 객체에 보관한다.
  const cache = useMemo(
    () => new FrameCache<LidarFrame>(LIDAR_FRAME_CACHE_CAPACITY),
    [source],
  );
  // 완료되기 전 요청도 timestamp별로 공유해 현재 로딩과 prefetch가 중복되지 않게 한다.
  const inFlightLoads = useMemo(
    () => new Map<number, Promise<LidarFrameLoadResult>>(),
    [source],
  );
  const [state, setState] = useState<CachedFrameState>({
    source,
    timestampMs: null,
    frame: null,
    status: "empty",
    entryCount: 0,
    loadDurationMs: null,
    error: null,
  });

  useEffect(() => {
    let ignoreResult = false;

    const getOrLoadFrame = (timestampMs: number) => {
      const cachedFrame = cache.get(timestampMs);
      if (cachedFrame) {
        return Promise.resolve({
          frame: cachedFrame,
          loadDurationMs: null,
        });
      }

      const inFlightLoad = inFlightLoads.get(timestampMs);
      if (inFlightLoad) return inFlightLoad;

      const loadStartedAt = performance.now();
      const load = source
        .loadFrame(timestampMs)
        .then((frame) => {
          if (frame) cache.set(frame);
          return {
            frame,
            loadDurationMs: performance.now() - loadStartedAt,
          };
        })
        .finally(() => {
          inFlightLoads.delete(timestampMs);
        });

      inFlightLoads.set(timestampMs, load);
      return load;
    };

    const prefetchNeighborFrames = async () => {
      const targetIndex = source.frames.findIndex(
        (frame) => frame.timestampMs === targetTimestampMs,
      );
      if (targetIndex === -1) return;

      const neighborTimestamps = [
        source.frames[targetIndex - 1]?.timestampMs,
        source.frames[targetIndex + 1]?.timestampMs,
      ].filter(
        (timestampMs): timestampMs is number => timestampMs !== undefined,
      );

      // 주변 Frame 실패는 현재의 정상 Frame을 오류로 바꾸지 않는다.
      await Promise.allSettled(
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
        source,
        timestampMs: null,
        frame: null,
        status: "empty",
        entryCount: cache.size,
        loadDurationMs: null,
        error: null,
      });
      return;
    }

    const cachedFrame = cache.get(targetTimestampMs);
    if (cachedFrame) {
      setState({
        source,
        timestampMs: targetTimestampMs,
        frame: cachedFrame,
        status: "hit",
        entryCount: cache.size,
        loadDurationMs: null,
        error: null,
      });
      void prefetchNeighborFrames();

      return () => {
        ignoreResult = true;
      };
    }

    setState({
      source,
      timestampMs: targetTimestampMs,
      frame: null,
      status: "loading",
      entryCount: cache.size,
      loadDurationMs: null,
      error: null,
    });

    void getOrLoadFrame(targetTimestampMs)
      .then((result) => {
        if (ignoreResult) return;
        if (!result.frame) throw new Error("선택한 LiDAR Frame을 찾을 수 없습니다.");

        setState({
          source,
          timestampMs: targetTimestampMs,
          frame: result.frame,
          status: "miss",
          entryCount: cache.size,
          loadDurationMs: result.loadDurationMs,
          error: null,
        });
        void prefetchNeighborFrames();
      })
      .catch((error: unknown) => {
        if (ignoreResult) return;
        setState({
          source,
          timestampMs: targetTimestampMs,
          frame: null,
          status: "error",
          entryCount: cache.size,
          loadDurationMs: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    // 빠른 seek로 목표가 바뀌면 이전 요청이 늦게 끝나도 현재 화면을 덮어쓰지 않는다.
    return () => {
      ignoreResult = true;
    };
  }, [cache, inFlightLoads, source, targetTimestampMs, requestAttempt]);

  useEffect(
    () => () => {
      // 컴포넌트가 사라질 때 Frame과 Float32Array 참조를 끊어 GC 대상이 되게 한다.
      cache.clear();
    },
    [cache],
  );

  const stateMatchesTarget =
    state.source === source && state.timestampMs === targetTimestampMs;

  return {
    frame: stateMatchesTarget ? state.frame : null,
    status:
      targetTimestampMs === null
        ? "empty"
        : stateMatchesTarget
          ? state.status
          : "loading",
    entryCount: state.source === source ? state.entryCount : 0,
    capacity: cache.capacity,
    loadDurationMs: stateMatchesTarget ? state.loadDurationMs : null,
    error: stateMatchesTarget ? state.error : null,
    retry: () => {
      setState((currentState) => ({
        ...currentState,
        status: "loading",
        error: null,
      }));
      setRequestAttempt((attempt) => attempt + 1);
    },
  };
}
