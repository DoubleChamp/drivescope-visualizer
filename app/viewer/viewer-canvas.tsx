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
import { formatSeconds } from "./_utils/format-time";
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
    capacity: lidarCacheCapacity,
    loadDurationMs: lidarLoadDurationMs,
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
  const primaryEvent =
    mockScenario.events.find((event) => event.type === "emergency-braking") ??
    null;

  return (
    <div className={styles.viewer}>
      <header className={styles.viewerHeader}>
        <div className={styles.viewerHeading}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            Incident review · Demo 01
          </p>
          <h1>보행자 급제동 시나리오</h1>
          <p>
            센서가 포착한 순간부터 차량이 반응하기까지, 모든 Frame을 하나의
            시간축에서 추적합니다.
          </p>
        </div>

        <dl className={styles.scenarioSummary} aria-label="시나리오 요약">
          <div>
            <dt>재생 구간</dt>
            <dd>{formatSeconds(mockScenario.durationMs)}초</dd>
          </div>
          <div>
            <dt>LiDAR Frame</dt>
            <dd>{mockScenario.lidarFrames.length}개</dd>
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
              durationMs={mockScenario.durationMs}
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
            durationMs={mockScenario.durationMs}
            events={mockScenario.events}
            isPlaying={isPlaying}
            onSeek={seek}
            onTogglePlayback={togglePlayback}
          />
        </section>

        <aside className={styles.analysisRail} aria-label="센서 분석 패널">
          <CameraPanel frame={frames.camera} />
          <SelectedObjectPanel
            object={selectedObject}
            frame={frames.objectDetection}
          />
          <SynchronizedFramesPanel
            currentTimeMs={currentTimeMs}
            cameraFrame={frames.camera}
            lidarFrame={lidarFrame}
            objectDetectionFrame={frames.objectDetection}
          />
        </aside>
      </div>
    </div>
  );
}
