"use client";

import { useRef } from "react";
import { CameraPanel } from "./_components/camera-panel";
import { PlaybackControls } from "./_components/playback-controls";
import { SelectedObjectPanel } from "./_components/selected-object-panel";
import { SynchronizedFramesPanel } from "./_components/synchronized-frames-panel";
import { ViewerMetrics } from "./_components/viewer-metrics";
import { findLatestFrameAtOrBefore } from "./_data/find-latest-frame-at-or-before";
import { loadMockLidarFrame } from "./_data/load-mock-lidar-frame";
import { mockScenario } from "./_data/mock-scenario";
import { selectScenarioFrames } from "./_data/select-scenario-frames";
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
  const { source: actualDataSource, error: actualDataError } =
    useDriveScopeDataSource();
  const lidarSource =
    actualDataSource ??
    (actualDataError === null ? LOADING_LIDAR_SOURCE : MOCK_LIDAR_SOURCE);
  const isActualData = actualDataSource !== null;
  const isActualDataLoading =
    actualDataSource === null && actualDataError === null;
  const isMockFallback = actualDataError !== null;
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
    <div className={styles.viewer}>
      <header className={styles.viewerHeader}>
        <div className={styles.viewerHeading}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            {isActualDataLoading
              ? "nuScenes mini · 연결 중"
              : isActualData
              ? `nuScenes mini · ${actualDataSource.manifest.scenarioId}`
              : "Incident review · Demo 01"}
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
              ? "manifest를 검증하고 실제 LiDAR 데이터 소스를 준비하고 있습니다."
              : isActualData
              ? "nuScenes의 LiDAR와 전방 카메라를 공통 시간축에서 재생합니다."
              : "센서가 포착한 순간부터 차량이 반응하기까지, 모든 Frame을 하나의 시간축에서 추적합니다."}
          </p>
        </div>

        <dl className={styles.scenarioSummary} aria-label="시나리오 요약">
          <div>
            <dt>재생 구간</dt>
            <dd>{formatSeconds(durationMs)}초</dd>
          </div>
          <div>
            <dt>LiDAR Frame</dt>
            <dd>{lidarSource.frames.length}개</dd>
          </div>
          <div className={styles.incidentSummary}>
            <dt>급제동 이벤트</dt>
            <dd>
              {primaryEvent
                ? `${formatSeconds(primaryEvent.timestampMs)}초`
                : "없음"}
            </dd>
          </div>
        </dl>
      </header>

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
            <span className={styles.synchronizedBadge}>
              <span aria-hidden="true" />
              공통 시간축
            </span>
          </header>

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
            />
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              aria-label="DriveScope 3D 뷰어"
              aria-describedby="scene-input-help"
            >
              3D LiDAR 장면입니다. 현재 객체 선택은 포인터 입력을 사용합니다.
            </canvas>
            <p id="scene-input-help" className={styles.visuallyHidden}>
              3D 장면에서 보행자 박스를 클릭하면 선택 객체 정보를 확인할 수
              있습니다.
            </p>
            <ul className={styles.sceneLegend} aria-label="3D 장면 범례">
              <li>
                <i className={styles.lidarLegend} aria-hidden="true" />
                LiDAR
              </li>
              <li>
                <i className={styles.objectLegend} aria-hidden="true" />
                객체
              </li>
              <li>
                <i className={styles.trajectoryLegend} aria-hidden="true" />
                예상 경로
              </li>
              <li>
                <i className={styles.riskLegend} aria-hidden="true" />
                충돌 위험
              </li>
            </ul>
          </div>

          <PlaybackControls
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            events={timelineEvents}
            isPlaying={isPlaying}
            onSeek={seek}
            onTogglePlayback={togglePlayback}
          />
        </section>

        <aside className={styles.analysisRail} aria-label="센서 분석 패널">
          <CameraPanel frame={cameraFrame} isActualData={isActualData} />
          <SelectedObjectPanel
            object={selectedObject}
            frame={objectDetectionFrame}
          />
          <SynchronizedFramesPanel
            currentTimeMs={currentTimeMs}
            cameraFrame={cameraFrame}
            lidarFrame={lidarFrame}
            objectDetectionFrame={objectDetectionFrame}
          />
        </aside>
      </div>
    </div>
  );
}
