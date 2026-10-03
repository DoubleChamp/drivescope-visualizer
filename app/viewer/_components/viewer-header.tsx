import type { ScenarioEvent } from "../_data/frame-types";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

export type ViewerSourceState = "loading" | "actual" | "mock";

type ViewerHeaderProps = {
  sourceState: ViewerSourceState;
  scenarioId: string | null;
  durationMs: number;
  lidarFrameCount: number;
  cameraFrameCount: number;
  primaryEvent: ScenarioEvent | null;
};

export function ViewerHeader({
  sourceState,
  scenarioId,
  durationMs,
  lidarFrameCount,
  cameraFrameCount,
  primaryEvent,
}: ViewerHeaderProps) {
  const isLoading = sourceState === "loading";
  const isActual = sourceState === "actual";
  const isMock = sourceState === "mock";

  return (
    <>
      <header className={styles.viewerHeader}>
        <div className={styles.viewerHeading}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            {isLoading
              ? "nuScenes mini · 연결 중"
              : isActual
                ? `nuScenes mini · ${scenarioId}`
                : "가상 급제동 데모 · Demo 01"}
          </p>
          <h1>
            {isLoading
              ? "실제 데이터 불러오는 중"
              : isActual
                ? "실제 센서 주행 장면"
                : "보행자 급제동 시나리오"}
          </h1>
          <p>
            {isLoading
              ? "센서 로그를 준비하고 있습니다. 연결이 끝나면 재생과 탐색을 시작할 수 있습니다."
              : isActual
                ? "점군과 전방 이미지를 같은 타임라인에서 살펴보고, 차량 위치와 센서 수집 시각을 비교하세요."
                : "센서가 포착한 순간부터 차량이 반응하기까지, 모든 Frame을 하나의 시간축에서 추적합니다."}
          </p>
        </div>

        <dl className={styles.scenarioSummary} aria-label="시나리오 요약">
          <div>
            <dt>재생 구간</dt>
            <dd>{isLoading ? "확인 중" : `${formatSeconds(durationMs)}초`}</dd>
          </div>
          <div>
            <dt>LiDAR Frame</dt>
            <dd>{isLoading ? "확인 중" : `${lidarFrameCount}개`}</dd>
          </div>
          <div className={primaryEvent ? styles.incidentSummary : undefined}>
            <dt>{isMock ? "급제동 이벤트" : "전방 이미지"}</dt>
            <dd>
              {isLoading
                ? "확인 중"
                : isActual
                  ? `${cameraFrameCount}장`
                  : primaryEvent
                    ? `${formatSeconds(primaryEvent.timestampMs)}초`
                    : "없음"}
            </dd>
          </div>
        </dl>
      </header>

      <div className={styles.sourceStrip}>
        <span className={styles.sourceBadge} data-state={sourceState}>
          <span aria-hidden="true" />
          {isLoading ? "연결 중" : isActual ? "실제 센서 로그" : "가상 데모"}
        </span>
        <p>
          {isLoading
            ? "LiDAR · 전방 이미지 · 차량 위치를 확인하고 있습니다."
            : isActual
              ? "객체 인식·예상 경로·급제동 이벤트는 아직 연결되지 않았습니다."
              : "보행자 등장부터 인식, 경로 충돌과 급제동까지 시간 순서를 살펴보세요."}
        </p>
      </div>
    </>
  );
}
