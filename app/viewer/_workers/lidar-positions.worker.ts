import { prepareLidarPositions } from "../_data/prepare-lidar-positions";
import type { LidarWorkerRequest, LidarWorkerResponse } from "../_data/lidar-positions-parser";

// DOM을 사용하지 않는다. tsconfig의 DOM lib와 충돌하는 global 선언은 추가하지 않는다.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LidarWorkerRequest>) => void) | null;
  postMessage: (message: LidarWorkerResponse, transfer?: Transferable[]) => void;
};

scope.onmessage = ({ data: { id, buffer, pointCount } }) => {
  try {
    const startedAt = performance.now();
    const positions = prepareLidarPositions(buffer, pointCount);
    const workerComputeMs = performance.now() - startedAt;
    scope.postMessage({ id, ok: true, positions, workerComputeMs }, [positions.buffer as ArrayBuffer]);
  } catch (error: unknown) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
