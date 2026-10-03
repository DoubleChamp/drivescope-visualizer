"use client";

import { useRef } from "react";
import { CameraPanel } from "./_components/camera-panel";
import { DataErrorNotice } from "./_components/data-error-notice";
import { EgoPosePanel } from "./_components/ego-pose-panel";
import { PlaybackControls } from "./_components/playback-controls";
import { SelectedObjectPanel } from "./_components/selected-object-panel";
import { SynchronizedFramesPanel } from "./_components/synchronized-frames-panel";
import { ViewerMetrics } from "./_components/viewer-metrics";
import { findLatestFrameAtOrBefore } from "./_data/find-latest-frame-at-or-before";
import { loadMockLidarFrame } from "./_data/load-mock-lidar-frame";
import { mockScenario } from "./_data/mock-scenario";
import { selectScenarioFrames } from "./_data/select-scenario-frames";
import { useBufferedCameraFrame } from "./_hooks/use-buffered-camera-frame";
import { useDriveScopeDataSource } from "./_hooks/use-drivescope-data-source";
import { useLidarFrameCache } from "./_hooks/use-lidar-frame-cache";
import type { LidarFrameSource } from "./_hooks/use-lidar-frame-cache";
import { useObjectSelection } from "./_hooks/use-object-selection";
import { usePlayback } from "./_hooks/use-playback";
import { useThreeViewer } from "./_hooks/use-three-viewer";
import { formatSeconds } from "./_utils/format-time";
import styles from "./viewer-canvas.module.css";

const MOCK_LIDAR_SOURCE: LidarFrameSource = {
  id: "mock:emergency-braking",
  frames: mockScenario.lidarFrames,
  loadFrame: (timestampMs) =>
    loadMockLidarFrame(mockScenario.lidarFrames, timestampMs),
};

const LOADING_LIDAR_SOURCE: LidarFrameSource = {
  id: "loading:drivescope-manifest",
  frames: [],
  loadFrame: async () => null,
};

export default function ViewerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    source: actualDataSource,
    error: actualDataError,
    retry: retryActualData,
  } = useDriveScopeDataSource();
  const lidarSource =
    actualDataSource ??
    (actualDataError === null ? LOADING_LIDAR_SOURCE : MOCK_LIDAR_SOURCE);
  const isActualData = actualDataSource !== null;
  const isActualDataLoading =
    actualDataSource === null && actualDataError === null;
  const isMockFallback = actualDataError !== null;
  const sourceState = isActualDataLoading
    ? "loading"
    : isActualData
      ? "actual"
      : "mock";
  const durationMs =
    actualDataSource?.manifest.durationMs ?? mockScenario.durationMs;
  const { currentTimeMs, isPlaying, seek, togglePlayback } = usePlayback(
    durationMs,
  );

  // 모든 센서가 같은 currentTimeMs를 입력으로 사용하되 각자의 주기대로 Frame을 선택한다.
  const frames = selectScenarioFrames(mockScenario, currentTimeMs);
  const lidarFrameMetadata = findLatestFrameAtOrBefore(
    lidarSource.frames,
    currentTimeMs,
  );
  const {
    frame: lidarFrame,
    status: lidarCacheStatus,
    entryCount: cachedLidarFrameCount,
    capacity: lidarCacheCapacity,
    loadDurationMs: lidarLoadDurationMs,
    error: lidarError,
    retry: retryLidar,
  } = useLidarFrameCache({
    source: lidarSource,
    targetTimestampMs: lidarFrameMetadata?.timestampMs ?? null,
  });
  const currentPedestrian =
    isMockFallback
      ? (frames.objectDetection?.objects.find(
          (object) => object.category === "pedestrian",
        ) ?? null)
      : null;
  const lidarPointCount = lidarFrame ? lidarFrame.positions.length / 3 : 0;
  const lidarPositionCapacity = Math.max(
    0,
    ...lidarSource.frames.map((frame) =>
      "pointCount" in frame && typeof frame.pointCount === "number"
        ? frame.pointCount * 3
        : 0,
    ),
  );
  const objectDetectionFrame = isMockFallback ? frames.objectDetection : null;
  const cameraFrame = isActualData
    ? findLatestFrameAtOrBefore(actualDataSource.cameraFrames, currentTimeMs)
    : isMockFallback
      ? frames.camera
      : null;
  const bufferedCamera = useBufferedCameraFrame(cameraFrame, lidarSource.id);
  const egoPoseFrame = isActualData
    ? findLatestFrameAtOrBefore(
        actualDataSource.manifest.egoVehicle.frames,
        currentTimeMs,
      )
    : isMockFallback
      ? frames.vehicleState
      : null;
  const { selectedObject, selectedObjectId, setSelectedObjectId } =
    useObjectSelection(objectDetectionFrame);
  const { framesPerSecond } = useThreeViewer({
    canvasRef,
    scenario: mockScenario,
    lidarFrame,
    pedestrian: currentPedestrian,
    egoPoseFrame,
    followEgoVehicle: isActualData,
    trajectoryFrame: isMockFallback ? frames.trajectory : null,
    selectedObjectId,
    setSelectedObjectId,
    lidarPositionCapacity,
  });
  const primaryEvent =
    isMockFallback
      ? (mockScenario.events.find(
          (event) => event.type === "emergency-braking",
        ) ?? null)
      : null;
  const timelineEvents = isMockFallback ? mockScenario.events : [];

  return (
    <div
      className={styles.viewer}
      data-source-state={sourceState}
      aria-busy={isActualDataLoading}
    >
      <header className={styles.viewerHeader}>
        <div className={styles.viewerHeading}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            {isActualDataLoading
              ? "nuScenes mini · 연결 중"
              : isActualData
              ? `nuScenes mini · ${actualDataSource.manifest.scenarioId}`
              : "가상 급제동 데모 · Demo 01"}
          </p>
          <h1>
            {isActualDataLoading
              ? "실제 데이터 불러오는 중"
              : isActualData
                ? "실제 센서 주행 장면"
                : "보행자 급제동 시나리오"}
          </h1>
          <p>
            {isActualDataLoading
              ? "센서 로그를 준비하고 있습니다. 연결이 끝나면 재생과 탐색을 시작할 수 있습니다."
              : isActualData
              ? "점군과 전방 이미지를 같은 타임라인에서 살펴보고, 차량 위치와 센서 수집 시각을 비교하세요."
              : "센서가 포착한 순간부터 차량이 반응하기까지, 모든 Frame을 하나의 시간축에서 추적합니다."}
          </p>
        </div>

        <dl className={styles.scenarioSummary} aria-label="시나리오 요약">
          <div>
            <dt>재생 구간</dt>
            <dd>{isActualDataLoading ? "확인 중" : `${formatSeconds(durationMs)}초`}</dd>
          </div>
          <div>
            <dt>LiDAR Frame</dt>
            <dd>{isActualDataLoading ? "확인 중" : `${lidarSource.frames.length}개`}</dd>
          </div>
          <div className={primaryEvent ? styles.incidentSummary : undefined}>
            <dt>{isMockFallback ? "급제동 이벤트" : "전방 이미지"}</dt>
            <dd>
              {isActualDataLoading
                ? "확인 중"
                : isActualData
                  ? `${actualDataSource.cameraFrames.length}장`
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
          {isActualDataLoading ? "연결 중" : isActualData ? "실제 센서 로그" : "가상 데모"}
        </span>
        <p>
          {isActualDataLoading
            ? "LiDAR · 전방 이미지 · 차량 위치를 확인하고 있습니다."
            : isActualData
              ? "객체 인식·예상 경로·급제동 이벤트는 아직 연결되지 않았습니다."
              : "보행자 등장부터 인식, 경로 충돌과 급제동까지 시간 순서를 살펴보세요."}
        </p>
      </div>

      {actualDataError && (
        <DataErrorNotice
          title="실제 데이터에 연결하지 못했습니다"
          message="데이터 목록 파일을 불러오거나 검증하지 못해 가상 데모를 표시하고 있습니다. 데이터 파일과 연결 상태를 확인한 뒤 다시 연결하세요."
          error={actualDataError}
          retryLabel="실제 데이터 다시 연결"
          onRetry={() => {
            seek(0);
            retryActualData();
          }}
        />
      )}

      <div className={styles.workspaceGrid}>
        <section className={styles.scenePanel} aria-labelledby="scene-title">
          <header className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <span className={styles.panelIndex} aria-hidden="true">
                01
              </span>
              <div>
                <p>Primary view</p>
                <h2 id="scene-title">3D LiDAR 장면</h2>
              </div>
            </div>
            <span
              className={styles.synchronizedBadge}
              data-state={lidarFrame ? "ready" : lidarCacheStatus === "error" ? "error" : "waiting"}
            >
              <span aria-hidden="true" />
              {isActualDataLoading
                ? "연결 중"
                : lidarCacheStatus === "error"
                  ? "LiDAR 로딩 실패"
                  : lidarCacheStatus === "loading"
                    ? "LiDAR 불러오는 중"
                    : lidarFrame
                      ? "공통 시간축"
                      : "LiDAR Frame 대기"}
            </span>
          </header>

          {lidarError && lidarFrameMetadata && (
            <DataErrorNotice
              title={`LiDAR ${formatSeconds(lidarFrameMetadata.timestampMs)}초 Frame 로딩 실패`}
              message="해당 시점의 점군을 표시하지 못했습니다. 파일과 연결 상태를 확인해 다시 시도하거나 다른 시점으로 이동하세요."
              error={lidarError}
              retryLabel="LiDAR 다시 시도"
              onRetry={() => {
                seek(currentTimeMs);
                retryLidar();
              }}
            />
          )}

          <div className={styles.canvasStage}>
            <ViewerMetrics
              pointCount={lidarPointCount}
              framesPerSecond={framesPerSecond}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              lidarCacheStatus={lidarCacheStatus}
              cachedLidarFrameCount={cachedLidarFrameCount}
              lidarCacheCapacity={lidarCacheCapacity}
              lidarLoadDurationMs={lidarLoadDurationMs}
              isDataLoading={isActualDataLoading}
            />
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              data-selectable={isMockFallback}
              aria-label="DriveScope 3D 뷰어"
              aria-describedby="scene-input-help"
            >
              {isMockFallback
                ? "3D LiDAR 장면입니다. 객체 선택은 포인터 입력을 사용합니다."
                : "3D LiDAR와 주행 차량 위치를 보여주는 장면입니다."}
            </canvas>
            <p id="scene-input-help" className={styles.visuallyHidden}>
              {isMockFallback
                ? "3D 장면에서 보행자 박스를 클릭하면 선택 객체 정보를 확인할 수 있습니다."
                : "타임라인을 이동해 LiDAR와 전방 이미지, 차량 위치를 함께 확인하세요."}
            </p>
            {(isActualDataLoading || (isActualData && lidarCacheStatus === "empty")) && (
              <div className={styles.canvasEmptyState} role="status">
                <strong>{isActualDataLoading ? "센서 로그 연결 중" : "점군 표시 대기"}</strong>
                <p>
                  {isActualDataLoading
                    ? "데이터가 준비되면 재생을 시작할 수 있습니다."
                    : lidarSource.frames.length === 0
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
              {!isActualDataLoading && (
                <li>
                  <i className={styles.objectLegend} aria-hidden="true" />
                  주행 차량
                </li>
              )}
              {isMockFallback && (
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

          <PlaybackControls
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            events={timelineEvents}
            isPlaying={isPlaying}
            onSeek={seek}
            onTogglePlayback={togglePlayback}
            disabled={isActualDataLoading}
          />
        </section>

        <aside className={styles.analysisRail} aria-label="센서 분석 패널">
          <CameraPanel
            camera={bufferedCamera}
            isActualData={isActualData}
            onRetry={() => {
              seek(currentTimeMs);
              bufferedCamera.retry();
            }}
          />
          {isMockFallback ? (
            <SelectedObjectPanel object={selectedObject} frame={objectDetectionFrame} />
          ) : (
            <EgoPosePanel frame={egoPoseFrame} isLoading={isActualDataLoading} />
          )}
          <SynchronizedFramesPanel
            currentTimeMs={currentTimeMs}
            cameraFrame={bufferedCamera.frame}
            lidarFrame={lidarFrame}
            objectDetectionFrame={objectDetectionFrame}
            egoPoseFrame={egoPoseFrame}
            isMockFallback={isMockFallback}
          />
        </aside>
      </div>
    </div>
  );
}
