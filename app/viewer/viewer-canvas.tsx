"use client";

import { useRef, useState } from "react";
import { CameraPanel } from "./_components/camera-panel";
import { DataErrorNotice } from "./_components/data-error-notice";
import { EgoPosePanel } from "./_components/ego-pose-panel";
import { PlaybackControls } from "./_components/playback-controls";
import { SelectedObjectPanel } from "./_components/selected-object-panel";
import { SynchronizedFramesPanel } from "./_components/synchronized-frames-panel";
import { ViewerMetrics } from "./_components/viewer-metrics";
import { LidarLoadDetails } from "./_components/lidar-load-details";
import { ViewerHeader } from "./_components/viewer-header";
import {
  ViewerSourceSelector,
  type ViewerMode,
} from "./_components/viewer-source-selector";
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
import type { LidarFrameSource } from "./_data/lidar-frame-source";
import { useObjectSelection } from "./_hooks/use-object-selection";
import { usePlayback } from "./_hooks/use-playback";
import { useThreeViewer } from "./_hooks/use-three-viewer";
import { formatSeconds } from "./_utils/format-time";
import styles from "./viewer-canvas.module.css";

const MOCK_LIDAR_SOURCE: LidarFrameSource = {
  id: "mock:emergency-braking",
  frames: mockScenario.lidarFrames,
  loadFrame: async (timestampMs) => ({
    frame: await loadMockLidarFrame(mockScenario.lidarFrames, timestampMs),
    timings: null,
  }),
};

const LOADING_LIDAR_SOURCE: LidarFrameSource = {
  id: "loading:drivescope-manifest",
  frames: [],
  loadFrame: async () => ({ frame: null, timings: null }),
};

export default function ViewerCanvas() {
  const [mode, setMode] = useState<ViewerMode>("actual");

  return (
    <div className={styles.viewer}>
      <ViewerSourceSelector mode={mode} onChange={setMode} />
      {/* 모드 전환 시 이전 Hook·Three.js cleanup을 실행하고 재생·선택·캐시를 새로 시작한다. */}
      <ViewerSession key={mode} mode={mode} />
    </div>
  );
}

function ViewerSession({ mode }: { mode: ViewerMode }) {
  // 데이터 소스와 공통 재생 시계
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    source: actualDataSource,
    error: actualDataError,
    retry: retryActualData,
  } = useDriveScopeDataSource(mode === "actual");
  const isActualData = mode === "actual" && actualDataSource !== null;
  const isActualDataLoading =
    mode === "actual" && actualDataSource === null && actualDataError === null;
  const isMockData = mode === "mock" || actualDataError !== null;
  const lidarSource = isMockData
    ? MOCK_LIDAR_SOURCE
    : actualDataSource ?? LOADING_LIDAR_SOURCE;
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
    loadMeasurement,
    prefetchMeasurements,
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
  const objectDetectionFrame = isMockData ? frames.objectDetection : null;
  const currentPedestrian =
    objectDetectionFrame?.objects.find(
      (object) => object.category === "pedestrian",
    ) ?? null;
  const cameraFrame = isActualData
    ? findLatestFrameAtOrBefore(actualDataSource.cameraFrames, currentTimeMs)
    : isMockData
      ? frames.camera
      : null;
  const bufferedCamera = useBufferedCameraFrame(cameraFrame, lidarSource.id);
  const egoPoseFrame = isActualData
    ? findLatestFrameAtOrBefore(
        actualDataSource.manifest.egoVehicle.frames,
        currentTimeMs,
      )
    : isMockData
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
    trajectoryFrame: isMockData ? frames.trajectory : null,
    selectedObjectId,
    setSelectedObjectId,
    lidarPositionCapacity,
  });
  const primaryEvent =
    isMockData
      ? (mockScenario.events.find(
          (event) => event.type === "emergency-braking",
        ) ?? null)
      : null;
  const timelineEvents = isMockData ? mockScenario.events : [];

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

          {isActualData && (
            <LidarLoadDetails
              measurement={loadMeasurement}
              prefetchMeasurements={prefetchMeasurements}
              status={lidarCacheStatus}
            />
          )}

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
          {isMockData ? (
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
            isMockData={isMockData}
          />
        </aside>
      </div>
    </div>
  );
}
