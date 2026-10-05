export type LidarPositionsParser = {
  parse: (buffer: ArrayBuffer, pointCount: number) => Promise<{
    positions: Float32Array;
    workerComputeMs: number;
  }>;
  dispose: () => void;
};

export type LidarWorkerRequest = {
  id: number;
  buffer: ArrayBuffer;
  pointCount: number;
};

export type LidarWorkerResponse = {
  id: number;
} & (
  | { ok: true; positions: Float32Array; workerComputeMs: number }
  | { ok: false; error: string }
);
