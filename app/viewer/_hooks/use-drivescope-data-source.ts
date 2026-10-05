import { useEffect, useState } from "react";
import {
  DRIVE_SCOPE_MANIFEST_URL,
  loadDriveScopeDataSource,
  type DriveScopeDataSource,
} from "../_data/load-drivescope-data-source";
import { createLidarPositionsWorker } from "../_workers/lidar-positions-worker-client";

type DriveScopeDataSourceState = {
  source: DriveScopeDataSource | null;
  error: Error | null;
};

export function useDriveScopeDataSource(enabled = true) {
  const [requestAttempt, setRequestAttempt] = useState(0);
  const [state, setState] = useState<DriveScopeDataSourceState>({
    source: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const abortController = new AbortController();
    // 학습/측정용 URL에서만 선택한다. SSR과 최초 client render의 출력은 바꾸지 않는다.
    const useWorker = new URLSearchParams(window.location.search).get("lidarParser") === "worker";
    const positionsParser = useWorker ? createLidarPositionsWorker() : undefined;

    void loadDriveScopeDataSource(
      DRIVE_SCOPE_MANIFEST_URL,
      abortController.signal,
      { positionsParser },
    )
      .then((source) => {
        if (abortController.signal.aborted) return;
        setState({ source, error: null });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        setState({
          source: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    return () => {
      abortController.abort();
      positionsParser?.dispose();
    };
  }, [enabled, requestAttempt]);

  const retry = () => {
    setState({ source: null, error: null });
    setRequestAttempt((attempt) => attempt + 1);
  };

  return { ...state, retry };
}
