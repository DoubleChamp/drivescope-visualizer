import type { ReactNode, RefObject } from "react";
import type { LidarCacheStatus } from "../_hooks/use-lidar-frame-cache";
import type { ViewerSourceState } from "./viewer-header";
import styles from "../viewer-canvas.module.css";

type ViewerScenePanelProps = {
  sourceState: ViewerSourceState;
  lidarCacheStatus: LidarCacheStatus;
  hasLidarFrame: boolean;
  children: ReactNode;
};

export function ViewerScenePanel({
  sourceState,
  lidarCacheStatus,
  hasLidarFrame,
  children,
}: ViewerScenePanelProps) {
  return (
    <section className={styles.scenePanel} aria-labelledby="scene-title">
      <header className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <span className={styles.panelIndex} aria-hidden="true">01</span>
          <div>
            <p>Primary view</p>
            <h2 id="scene-title">3D LiDAR 장면</h2>
          </div>
        </div>
        <span
          className={styles.synchronizedBadge}
          data-state={hasLidarFrame ? "ready" : lidarCacheStatus === "error" ? "error" : "waiting"}
        >
          <span aria-hidden="true" />
          {sourceState === "loading"
            ? "연결 중"
            : lidarCacheStatus === "error"
              ? "LiDAR 로딩 실패"
              : lidarCacheStatus === "loading"
                ? "LiDAR 불러오는 중"
                : hasLidarFrame
                  ? "공통 시간축"
                  : "LiDAR Frame 대기"}
        </span>
      </header>
      {children}
    </section>
  );
}

type ViewerSceneStageProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sourceState: ViewerSourceState;
  lidarCacheStatus: LidarCacheStatus;
  hasLidarFrames: boolean;
  children: ReactNode;
};

export function ViewerSceneStage({
  canvasRef,
  sourceState,
  lidarCacheStatus,
  hasLidarFrames,
  children,
}: ViewerSceneStageProps) {
  const isLoading = sourceState === "loading";
  const isMock = sourceState === "mock";
  const showEmptyState =
    isLoading || (sourceState === "actual" && lidarCacheStatus === "empty");

  return (
    <div className={styles.canvasStage}>
      {children}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-selectable={isMock}
        aria-label="DriveScope 3D Viewer"
        aria-describedby="scene-input-help"
      >
        {isMock
          ? "3D LiDAR 장면입니다. 객체 선택은 포인터 입력을 사용합니다."
          : "3D LiDAR와 주행 차량 위치를 보여주는 장면입니다."}
      </canvas>
      <p id="scene-input-help" className={styles.visuallyHidden}>
        {isMock
          ? "3D 장면에서 보행자 박스를 클릭하면 선택 객체 정보를 확인할 수 있습니다."
          : "타임라인을 이동해 LiDAR와 전방 이미지, 차량 위치를 함께 확인하세요."}
      </p>
      {showEmptyState && (
        <div className={styles.canvasEmptyState} role="status">
          <strong>{isLoading ? "센서 로그 연결 중" : "점군 표시 대기"}</strong>
          <p>
            {isLoading
              ? "데이터가 준비되면 재생을 시작할 수 있습니다."
              : !hasLidarFrames
                ? "이 로그에는 LiDAR Frame이 없습니다."
                : "현재 시각 이전의 LiDAR Frame이 없습니다. 재생하거나 타임라인을 이동하세요."}
          </p>
        </div>
      )}
      <ul className={styles.sceneLegend} aria-label="3D 장면 범례">
        <li>
          <i className={styles.lidarLegend} aria-hidden="true" />
          LiDAR
        </li>
        {!isLoading && (
          <li>
            <i className={styles.objectLegend} aria-hidden="true" />
            주행 차량
          </li>
        )}
        {isMock && (
          <>
            <li>
              <i className={styles.pedestrianLegend} aria-hidden="true" />
              보행자
            </li>
            <li>
              <i className={styles.trajectoryLegend} aria-hidden="true" />
              예상 경로
            </li>
            <li>
              <i className={styles.riskLegend} aria-hidden="true" />
              충돌 위험
            </li>
          </>
        )}
      </ul>
    </div>
  );
}
