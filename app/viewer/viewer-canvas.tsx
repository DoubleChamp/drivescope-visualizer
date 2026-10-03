"use client";

import { useRef } from "react";
import { CameraPanel } from "./_components/camera-panel";
import { DataErrorNotice } from "./_components/data-error-notice";
import { EgoPosePanel } from "./_components/ego-pose-panel";
import { PlaybackControls } from "./_components/playback-controls";
import { SelectedObjectPanel } from "./_components/selected-object-panel";
import { SynchronizedFramesPanel } from "./_components/synchronized-frames-panel";
import { ViewerMetrics } from "./_components/viewer-metrics";
import { ViewerHeader } from "./_components/viewer-header";
import {
  ViewerScenePanel,
  ViewerSceneStage,
} from "./_components/viewer-scene-panel";
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
  // 데이터 소스와 공통 재생 시계
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
  const currentPedestrian =
    objectDetectionFrame?.objects.find(
      (object) => object.category === "pedestrian",
    ) ?? null;
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
  // 선택 상태와 Three.js 런타임 연결
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
      <ViewerHeader
        sourceState={sourceState}
        scenarioId={actualDataSource?.manifest.scenarioId ?? null}
        durationMs={durationMs}
        lidarFrameCount={lidarSource.frames.length}
        cameraFrameCount={actualDataSource?.cameraFrames.length ?? 0}
        primaryEvent={primaryEvent}
      />

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
        <ViewerScenePanel
          sourceState={sourceState}
          lidarCacheStatus={lidarCacheStatus}
          hasLidarFrame={lidarFrame !== null}
        >

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

          <ViewerSceneStage
            canvasRef={canvasRef}
            sourceState={sourceState}
            lidarCacheStatus={lidarCacheStatus}
            hasLidarFrames={lidarSource.frames.length > 0}
          >
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
          </ViewerSceneStage>

          <PlaybackControls
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            events={timelineEvents}
            isPlaying={isPlaying}
            onSeek={seek}
            onTogglePlayback={togglePlayback}
            disabled={isActualDataLoading}
          />
        </ViewerScenePanel>

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
