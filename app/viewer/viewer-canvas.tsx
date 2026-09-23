"use client";

import { useRef } from "react";
import { CameraPanel } from "./_components/camera-panel";
import { PlaybackControls } from "./_components/playback-controls";
import { SelectedObjectPanel } from "./_components/selected-object-panel";
import { SynchronizedFramesPanel } from "./_components/synchronized-frames-panel";
import { ViewerMetrics } from "./_components/viewer-metrics";
import { mockScenario } from "./_data/mock-scenario";
import { selectScenarioFrames } from "./_data/select-scenario-frames";
import { useLidarFrameCache } from "./_hooks/use-lidar-frame-cache";
import { useObjectSelection } from "./_hooks/use-object-selection";
import { usePlayback } from "./_hooks/use-playback";
import { useThreeViewer } from "./_hooks/use-three-viewer";
import styles from "./viewer-canvas.module.css";

export default function ViewerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTimeMs, isPlaying, seek, togglePlayback } = usePlayback(
    mockScenario.durationMs,
  );

  // 모든 센서가 같은 currentTimeMs를 입력으로 사용하되 각자의 주기대로 Frame을 선택한다.
  const frames = selectScenarioFrames(mockScenario, currentTimeMs);
  const {
    frame: lidarFrame,
    status: lidarCacheStatus,
    entryCount: cachedLidarFrameCount,
  } = useLidarFrameCache({
    sourceFrames: mockScenario.lidarFrames,
    targetTimestampMs: frames.lidar?.timestampMs ?? null,
  });
  const currentPedestrian =
    frames.objectDetection?.objects.find(
      (object) => object.category === "pedestrian",
    ) ?? null;
  const lidarPointCount = lidarFrame ? lidarFrame.positions.length / 3 : 0;
  const { selectedObject, selectedObjectId, setSelectedObjectId } =
    useObjectSelection(frames.objectDetection);
  const { framesPerSecond } = useThreeViewer({
    canvasRef,
    scenario: mockScenario,
    lidarFrame,
    pedestrian: currentPedestrian,
    vehicleStateFrame: frames.vehicleState,
    trajectoryFrame: frames.trajectory,
    selectedObjectId,
    setSelectedObjectId,
  });

  return (
    <div className={styles.viewer}>
      <ViewerMetrics
        pointCount={lidarPointCount}
        framesPerSecond={framesPerSecond}
        currentTimeMs={currentTimeMs}
        durationMs={mockScenario.durationMs}
        lidarCacheStatus={lidarCacheStatus}
        cachedLidarFrameCount={cachedLidarFrameCount}
      />
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="DriveScope 3D 뷰어"
      />
      <SynchronizedFramesPanel
        currentTimeMs={currentTimeMs}
        cameraFrame={frames.camera}
        lidarFrame={lidarFrame}
        objectDetectionFrame={frames.objectDetection}
      />
      <CameraPanel frame={frames.camera} />
      <SelectedObjectPanel
        object={selectedObject}
        frame={frames.objectDetection}
      />
      <PlaybackControls
        currentTimeMs={currentTimeMs}
        durationMs={mockScenario.durationMs}
        events={mockScenario.events}
        isPlaying={isPlaying}
        onSeek={seek}
        onTogglePlayback={togglePlayback}
      />
    </div>
  );
}
