"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from "three";
import { findLatestFrameAtOrBefore } from "./_data/find-latest-frame-at-or-before";
import type { ScenarioEvent } from "./_data/frame-types";
import { mockScenario } from "./_data/mock-scenario";
import styles from "./viewer-canvas.module.css";

const FPS_SAMPLE_INTERVAL_MS = 1_000;
const INITIAL_PLAYBACK_TIME_MS = 0;
const PLAYBACK_UPDATE_INTERVAL_MS = 100;
const LIDAR_POSITION_BUFFER_LENGTH = Math.max(
  0,
  ...mockScenario.lidarFrames.map((frame) => frame.positions.length),
);
const EVENT_TYPE_LABELS: Record<ScenarioEvent["type"], string> = {
  "emergency-braking": "급제동",
};

const formatTimestampDifference = (differenceMs: number) =>
  `${differenceMs > 0 ? "+" : ""}${differenceMs.toLocaleString("ko-KR")}ms`;

export default function ViewerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lidarGeometryRef = useRef<BufferGeometry | null>(null);
  const lidarPositionAttributeRef = useRef<BufferAttribute | null>(null);
  const pedestrianBoxRef = useRef<Mesh | null>(null);
  const playbackStartedAtRef = useRef(0);
  const playbackTimeAtStartRef = useRef(INITIAL_PLAYBACK_TIME_MS);
  const [framesPerSecond, setFramesPerSecond] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(
    INITIAL_PLAYBACK_TIME_MS,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const selectedCameraFrame = findLatestFrameAtOrBefore(
    mockScenario.cameraFrames,
    currentTimeMs,
  );
  const selectedLidarFrame = findLatestFrameAtOrBefore(
    mockScenario.lidarFrames,
    currentTimeMs,
  );
  const selectedObjectDetectionFrame = findLatestFrameAtOrBefore(
    mockScenario.objectDetectionFrames,
    currentTimeMs,
  );
  const selectedLidarPointCount = selectedLidarFrame
    ? selectedLidarFrame.positions.length / 3
    : 0;
  const objectDetectionSummary = selectedObjectDetectionFrame
    ? selectedObjectDetectionFrame.objects.length === 0
      ? "객체 없음"
      : selectedObjectDetectionFrame.objects
          .map((object) => `${object.id} (${object.category})`)
          .join(", ")
    : null;
  // TODO: 실제 데이터에서 이 계산이 병목으로 측정되면 currentTimeMs 기준 useMemo를 검토한다.
  const synchronizedFrames = [
    {
      label: "Camera",
      frame: selectedCameraFrame,
      detail: selectedCameraFrame?.imageUrl ?? null,
    },
    {
      label: "LiDAR",
      frame: selectedLidarFrame,
      detail: selectedLidarFrame
        ? `${selectedLidarPointCount.toLocaleString("ko-KR")}개 포인트`
        : null,
    },
    {
      label: "Object Detection",
      frame: selectedObjectDetectionFrame,
      detail: objectDetectionSummary,
    },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scene = new Scene();
    const grid = new GridHelper(80, 16);
    const camera = new PerspectiveCamera(60, width / height, 0.1, 1000);

    scene.add(grid);

    const pointPositions = new Float32Array(LIDAR_POSITION_BUFFER_LENGTH);
    const positionAttribute = new BufferAttribute(pointPositions, 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const pointsGeometry = new BufferGeometry();
    pointsGeometry.setAttribute("position", positionAttribute);
    pointsGeometry.setDrawRange(0, 0);
    const pointsMaterial = new PointsMaterial({ color: 0x38bdf8, size: 0.18 });
    const points = new Points(pointsGeometry, pointsMaterial);

    lidarGeometryRef.current = pointsGeometry;
    lidarPositionAttributeRef.current = positionAttribute;
    scene.add(points);

    const pedestrianBoxGeometry = new BoxGeometry(1, 1, 1);
    const pedestrianBoxMaterial = new MeshBasicMaterial({
      color: 0xf97316,
      wireframe: true,
    });
    const pedestrianBox = new Mesh(
      pedestrianBoxGeometry,
      pedestrianBoxMaterial,
    );
    pedestrianBox.visible = false;
    pedestrianBoxRef.current = pedestrianBox;
    scene.add(pedestrianBox);

    camera.position.set(30, 25, -30);
    camera.lookAt(0, 0, -10);

    const renderer = new WebGLRenderer({ canvas });
    const handleResize = () => {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;

      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    };
    let animationFrameId: number;
    let sampleStartedAt: number | null = null;
    let renderedFrameCount = 0;
    const renderFrame = (timestamp: number) => {
      renderer.render(scene, camera);

      if (sampleStartedAt === null) {
        sampleStartedAt = timestamp;
      } else {
        renderedFrameCount += 1;

        const elapsedMilliseconds = timestamp - sampleStartedAt;

        if (elapsedMilliseconds >= FPS_SAMPLE_INTERVAL_MS) {
          const nextFramesPerSecond = Math.round(
            (renderedFrameCount * 1_000) / elapsedMilliseconds,
          );

          setFramesPerSecond(nextFramesPerSecond);
          renderedFrameCount = 0;
          sampleStartedAt = timestamp;
        }
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      lidarGeometryRef.current = null;
      lidarPositionAttributeRef.current = null;
      pedestrianBoxRef.current = null;
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      pedestrianBoxGeometry.dispose();
      pedestrianBoxMaterial.dispose();
      grid.dispose();
      scene.clear();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const pointsGeometry = lidarGeometryRef.current;
    const positionAttribute = lidarPositionAttributeRef.current;

    if (!pointsGeometry || !positionAttribute) {
      return;
    }

    if (!selectedLidarFrame) {
      pointsGeometry.setDrawRange(0, 0);
      return;
    }

    const pointPositions = positionAttribute.array as Float32Array;

    pointPositions.set(selectedLidarFrame.positions);
    positionAttribute.needsUpdate = true;
    pointsGeometry.setDrawRange(0, selectedLidarPointCount);
    pointsGeometry.computeBoundingSphere();
  }, [selectedLidarFrame, selectedLidarPointCount]);

  // null은 새 객체가 아니라 원시값이므로 null이 유지되면 React의 Object.is 의존성 비교에서 변화로 보지 않는다.
  // 현재 mock은 0초부터 빈 Detection Frame을 가지므로 Frame 참조가 1초마다 바뀔 때만 이 effect가 다시 실행된다.
  // TODO: 실제 데이터에서 빈 Detection Frame 갱신이 병목으로 측정되면 선택된 pedestrian을 별도 파생값으로 분리할지 검토한다.
  useEffect(() => {
    const pedestrianBox = pedestrianBoxRef.current;

    if (!pedestrianBox) {
      return;
    }

    const pedestrian = selectedObjectDetectionFrame?.objects.find(
      (object) => object.category === "pedestrian",
    );

    if (!pedestrian) {
      pedestrianBox.visible = false;
      return;
    }

    const [centerX, centerY, centerZ] = pedestrian.center;
    const [width, length, height] = pedestrian.size;

    pedestrianBox.position.set(centerX, centerY, centerZ);
    pedestrianBox.scale.set(width, height, length);
    pedestrianBox.rotation.set(0, pedestrian.yawRadians, 0);
    pedestrianBox.visible = true;
  }, [selectedObjectDetectionFrame]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const elapsedMilliseconds =
        performance.now() - playbackStartedAtRef.current;
      const nextTimeMs = Math.min(
        Math.round(playbackTimeAtStartRef.current + elapsedMilliseconds),
        mockScenario.durationMs,
      );

      setCurrentTimeMs(nextTimeMs);

      if (nextTimeMs >= mockScenario.durationMs) {
        setIsPlaying(false);
      }
    }, PLAYBACK_UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying]);

  const handlePlaybackToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const nextStartTimeMs =
      currentTimeMs >= mockScenario.durationMs
        ? INITIAL_PLAYBACK_TIME_MS
        : currentTimeMs;

    setCurrentTimeMs(nextStartTimeMs);
    playbackTimeAtStartRef.current = nextStartTimeMs;
    playbackStartedAtRef.current = performance.now();
    setIsPlaying(true);
  };

  const handleTimelineChange = (nextTimeMs: number) => {
    setIsPlaying(false);
    setCurrentTimeMs(nextTimeMs);
  };

  return (
    <div className={styles.viewer}>
      <dl className={styles.metrics} aria-label="뷰어 통계">
        <div className={styles.metric}>
          <dt>포인트 수</dt>
          <dd>{selectedLidarPointCount.toLocaleString("ko-KR")}</dd>
        </div>
        <div className={styles.metric}>
          <dt>FPS</dt>
          <dd>{framesPerSecond ?? "측정 중"}</dd>
        </div>
        <div className={styles.metric}>
          <dt>재생 시간</dt>
          <dd>
            {(currentTimeMs / 1_000).toFixed(1)} /{" "}
            {(mockScenario.durationMs / 1_000).toFixed(1)}초
          </dd>
        </div>
      </dl>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="DriveScope 3D 뷰어"
      />
      <dl className={styles.synchronizedFrames} aria-label="동기화된 Frame">
        {synchronizedFrames.map(({ label, frame, detail }) => (
          <div key={label} className={styles.synchronizedFrame}>
            <dt>{label}</dt>
            <dd>
              {frame === null ? (
                "Frame 없음"
              ) : (
                <>
                  <span className={styles.frameTimestamp}>
                    {(frame.timestampMs / 1_000).toFixed(1)}초
                    <span className={styles.timestampDifference}>
                      {formatTimestampDifference(
                        frame.timestampMs - currentTimeMs,
                      )}
                    </span>
                  </span>
                  <span className={styles.frameDetail}>{detail}</span>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playbackButton}
          aria-pressed={isPlaying}
          onClick={handlePlaybackToggle}
        >
          {isPlaying ? "정지" : "재생"}
        </button>
        <div className={styles.timelineControl}>
          <label htmlFor="viewer-timeline" className={styles.timelineLabel}>
            타임라인
          </label>
          <div className={styles.timelineTrack}>
            <input
              id="viewer-timeline"
              type="range"
              className={styles.timeline}
              min={INITIAL_PLAYBACK_TIME_MS}
              max={mockScenario.durationMs}
              step={PLAYBACK_UPDATE_INTERVAL_MS}
              value={currentTimeMs}
              aria-valuetext={`${(currentTimeMs / 1_000).toFixed(1)}초`}
              onChange={(event) =>
                handleTimelineChange(event.currentTarget.valueAsNumber)
              }
            />
            <div className={styles.timelineEvents}>
              {mockScenario.events.map((event) => {
                const eventLabel = EVENT_TYPE_LABELS[event.type];
                const eventTimeInSeconds = (event.timestampMs / 1_000).toFixed(
                  1,
                );
                const positionPercent =
                  (event.timestampMs / mockScenario.durationMs) * 100;
                const accessibleLabel = `${eventLabel} ${eventTimeInSeconds}초`;

                return (
                  <span
                    key={event.id}
                    role="img"
                    className={styles.timelineEvent}
                    style={{ left: `${positionPercent}%` }}
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                  >
                    <span aria-hidden="true">{accessibleLabel}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
