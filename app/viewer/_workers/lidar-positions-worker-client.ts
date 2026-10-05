import type { LidarPositionsParser, LidarWorkerResponse } from "../_data/lidar-positions-parser";

const REQUEST_TIMEOUT_MS = 20_000;

// 한 데이터 세션에서 한 Worker를 지연 생성해 여러 current/prefetch 요청을 ID로 구분한다.
export function createLidarPositionsWorker(): LidarPositionsParser {
  let worker: Worker | null = null;
  let disposed = false;
  let nextId = 0;
  const pending = new Map<number, {
    resolve: (result: { positions: Float32Array; workerComputeMs: number }) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  const failAll = (error: Error) => {
    worker?.terminate();
    worker = null;
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    pending.clear();
  };

  const getWorker = () => {
    if (worker) return worker;
    const createdWorker = new Worker(new URL("./lidar-positions.worker.ts", import.meta.url), { type: "module" });
    worker = createdWorker;
    createdWorker.addEventListener("message", (event: MessageEvent<LidarWorkerResponse>) => {
      if (worker !== createdWorker) return;
      const result = event.data;
      const task = pending.get(result.id);
      if (!task) return;
      pending.delete(result.id);
      clearTimeout(task.timer);
      if (result.ok) task.resolve({ positions: result.positions, workerComputeMs: result.workerComputeMs });
      else task.reject(new Error(result.error));
    });
    createdWorker.addEventListener("error", () => {
      if (worker === createdWorker) failAll(new Error("LiDAR 좌표 Worker 실행에 실패했습니다."));
    });
    createdWorker.addEventListener("messageerror", () => {
      if (worker === createdWorker) failAll(new Error("LiDAR 좌표 Worker 결과를 읽지 못했습니다."));
    });
    return createdWorker;
  };

  return {
    parse(buffer, pointCount) {
      if (disposed) return Promise.reject(new Error("LiDAR 좌표 Worker 세션이 종료됐습니다."));
      return new Promise((resolve, reject) => {
        const targetWorker = getWorker();
        const id = ++nextId;
        const timer = setTimeout(() => failAll(new Error("LiDAR 좌표 Worker 응답 시간이 초과됐습니다.")), REQUEST_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        try {
          targetWorker.postMessage({ id, buffer, pointCount }, [buffer]);
        } catch (error: unknown) {
          pending.delete(id);
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    dispose() {
      disposed = true;
      failAll(new Error("LiDAR 좌표 Worker 세션이 종료됐습니다."));
    },
  };
}
