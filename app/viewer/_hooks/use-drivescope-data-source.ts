import { useEffect, useState } from "react";
import {
  DRIVE_SCOPE_MANIFEST_URL,
  loadDriveScopeDataSource,
  type DriveScopeDataSource,
} from "../_data/load-drivescope-data-source";

type DriveScopeDataSourceState = {
  source: DriveScopeDataSource | null;
  error: Error | null;
};

export function useDriveScopeDataSource() {
  const [state, setState] = useState<DriveScopeDataSourceState>({
    source: null,
    error: null,
  });

  useEffect(() => {
    const abortController = new AbortController();

    void loadDriveScopeDataSource(
      DRIVE_SCOPE_MANIFEST_URL,
      abortController.signal,
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

    return () => abortController.abort();
  }, []);

  return state;
}
