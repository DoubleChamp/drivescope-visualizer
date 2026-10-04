import type { LidarFrame } from "./frame-types";

export type LidarLoadTimings = {
  responseHeadersMs: number;
  responseBodyMs: number;
  preparePositionsMs: number;
};

export type LidarFrameSource = {
  id: string;
  frames: readonly { timestampMs: number }[];
  loadFrame: (timestampMs: number) => Promise<{
    frame: LidarFrame | null;
    // 가상 로더에는 HTTP 구간이 없으므로 세부 시간을 꾸며 넣지 않는다.
    timings: LidarLoadTimings | null;
  }>;
};

export type LidarLoadMeasurement = {
  timestampMs: number;
  requestKind: "current" | "prefetch";
  startedAtMs: number;
  loadDurationMs: number;
  timings: LidarLoadTimings | null;
};
