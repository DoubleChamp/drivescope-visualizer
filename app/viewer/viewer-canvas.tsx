"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  GridHelper,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import {
  findAxisAlignedTrajectoryCollisionSegments,
} from "./_analysis/find-axis-aligned-trajectory-collision-segments";
import { findLatestFrameAtOrBefore } from "./_data/find-latest-frame-at-or-before";
import type { ScenarioEvent } from "./_data/frame-types";
import { mockScenario } from "./_data/mock-scenario";
import styles from "./viewer-canvas.module.css";

const FPS_SAMPLE_INTERVAL_MS = 1_000;
const INITIAL_PLAYBACK_TIME_MS = 0;
const PLAYBACK_UPDATE_INTERVAL_MS = 100;
const TRAJECTORY_RENDER_HEIGHT = 0.05;
const COLLISION_RENDER_HEIGHT = TRAJECTORY_RENDER_HEIGHT + 0.02;
const PEDESTRIAN_DEFAULT_COLOR = 0xf97316;
const PEDESTRIAN_SELECTED_COLOR = 0xe879f9;
const LIDAR_POSITION_BUFFER_LENGTH = Math.max(
  0,
  ...mockScenario.lidarFrames.map((frame) => frame.positions.length),
);
const TRAJECTORY_POSITION_BUFFER_LENGTH = Math.max(
  0,
  ...mockScenario.trajectoryFrames.map((frame) => frame.points.length * 3),
);
const COLLISION_POSITION_BUFFER_LENGTH = Math.max(
  0,
  ...mockScenario.trajectoryFrames.map(
    (frame) => Math.max(0, frame.points.length - 1) * 2 * 3,
  ),
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
  const pedestrianBoxMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const vehicleBoxRef = useRef<Mesh | null>(null);
  const trajectoryGeometryRef = useRef<BufferGeometry | null>(null);
  const trajectoryPositionAttributeRef = useRef<BufferAttribute | null>(null);
  const collisionGeometryRef = useRef<BufferGeometry | null>(null);
  const collisionPositionAttributeRef = useRef<BufferAttribute | null>(null);
  const playbackStartedAtRef = useRef(0);
  const playbackTimeAtStartRef = useRef(INITIAL_PLAYBACK_TIME_MS);
  const [framesPerSecond, setFramesPerSecond] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(
    INITIAL_PLAYBACK_TIME_MS,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
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
  const selectedVehicleStateFrame = findLatestFrameAtOrBefore(
    mockScenario.vehicleStateFrames,
    currentTimeMs,
  );
  const selectedTrajectoryFrame = findLatestFrameAtOrBefore(
    mockScenario.trajectoryFrames,
    currentTimeMs,
  );
  const currentPedestrian =
    selectedObjectDetectionFrame?.objects.find(
      (object) => object.category === "pedestrian",
    ) ?? null;
  const currentPedestrianId = currentPedestrian?.id ?? null;
  const selectedObject =
    selectedObjectDetectionFrame?.objects.find(
      (object) => object.id === selectedObjectId,
    ) ?? null;
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

    const boxGeometry = new BoxGeometry(1, 1, 1);
    const pedestrianBoxMaterial = new MeshBasicMaterial({
      color: PEDESTRIAN_DEFAULT_COLOR,
      wireframe: true,
    });
    const pedestrianBox = new Mesh(boxGeometry, pedestrianBoxMaterial);
    pedestrianBox.visible = false;
    pedestrianBoxRef.current = pedestrianBox;
    pedestrianBoxMaterialRef.current = pedestrianBoxMaterial;
    scene.add(pedestrianBox);

    const vehicleBoxMaterial = new MeshBasicMaterial({
      color: 0x22c55e,
      wireframe: true,
    });
    const vehicleBox = new Mesh(boxGeometry, vehicleBoxMaterial);
    vehicleBox.visible = false;
    vehicleBoxRef.current = vehicleBox;
    scene.add(vehicleBox);

    const trajectoryPositions = new Float32Array(
      TRAJECTORY_POSITION_BUFFER_LENGTH,
    );
    const trajectoryPositionAttribute = new BufferAttribute(
      trajectoryPositions,
      3,
    );
    trajectoryPositionAttribute.setUsage(DynamicDrawUsage);
    const trajectoryGeometry = new BufferGeometry();
    trajectoryGeometry.setAttribute("position", trajectoryPositionAttribute);
    trajectoryGeometry.setDrawRange(0, 0);
    const trajectoryMaterial = new LineBasicMaterial({ color: 0xfacc15 });
    const trajectoryLine = new Line(trajectoryGeometry, trajectoryMaterial);

    trajectoryGeometryRef.current = trajectoryGeometry;
    trajectoryPositionAttributeRef.current = trajectoryPositionAttribute;
    scene.add(trajectoryLine);

    const collisionPositions = new Float32Array(
      COLLISION_POSITION_BUFFER_LENGTH,
    );
    const collisionPositionAttribute = new BufferAttribute(
      collisionPositions,
      3,
    );
    collisionPositionAttribute.setUsage(DynamicDrawUsage);
    const collisionGeometry = new BufferGeometry();
    collisionGeometry.setAttribute("position", collisionPositionAttribute);
    collisionGeometry.setDrawRange(0, 0);
    const collisionMaterial = new LineBasicMaterial({ color: 0xef4444 });
    const collisionLineSegments = new LineSegments(
      collisionGeometry,
      collisionMaterial,
    );

    collisionGeometryRef.current = collisionGeometry;
    collisionPositionAttributeRef.current = collisionPositionAttribute;
    scene.add(collisionLineSegments);

    camera.position.set(30, 25, -30);
    camera.lookAt(0, 0, -10);

    const renderer = new WebGLRenderer({ canvas });
    const raycaster = new Raycaster();
    const pointerPosition = new Vector2();
    const handleResize = () => {
      const nextWidth = canvas.clientWidth;
      const nextHeight = canvas.clientHeight;

      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    };
    const handleCanvasClick = (event: MouseEvent) => {
      const canvasBounds = canvas.getBoundingClientRect();

      if (
        canvasBounds.width === 0 ||
        canvasBounds.height === 0 ||
        !pedestrianBox.visible
      ) {
        setSelectedObjectId(null);
        return;
      }

      pointerPosition.set(
        ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1,
        -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1,
      );

      camera.updateMatrixWorld();
      pedestrianBox.updateWorldMatrix(true, false);
      raycaster.setFromCamera(pointerPosition, camera);

      const objectId = pedestrianBox.userData.objectId;
      const intersectsPedestrian =
        raycaster.intersectObject(pedestrianBox, false).length > 0;

      setSelectedObjectId(
        intersectsPedestrian && typeof objectId === "string" ? objectId : null,
      );
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
    canvas.addEventListener("click", handleCanvasClick);
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("click", handleCanvasClick);
      lidarGeometryRef.current = null;
      lidarPositionAttributeRef.current = null;
      pedestrianBoxRef.current = null;
      pedestrianBoxMaterialRef.current = null;
      vehicleBoxRef.current = null;
      trajectoryGeometryRef.current = null;
      trajectoryPositionAttributeRef.current = null;
      collisionGeometryRef.current = null;
      collisionPositionAttributeRef.current = null;
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      boxGeometry.dispose();
      pedestrianBoxMaterial.dispose();
      vehicleBoxMaterial.dispose();
      trajectoryGeometry.dispose();
      trajectoryMaterial.dispose();
      collisionGeometry.dispose();
      collisionMaterial.dispose();
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

    if (!currentPedestrian) {
      pedestrianBox.visible = false;
      delete pedestrianBox.userData.objectId;
      return;
    }

    const [centerX, centerY, centerZ] = currentPedestrian.center;
    const [width, length, height] = currentPedestrian.size;

    pedestrianBox.position.set(centerX, centerY, centerZ);
    pedestrianBox.scale.set(width, height, length);
    pedestrianBox.rotation.set(0, currentPedestrian.yawRadians, 0);
    pedestrianBox.userData.objectId = currentPedestrian.id;
    pedestrianBox.visible = true;
  }, [currentPedestrian]);

  useEffect(() => {
    setSelectedObjectId((currentSelectedObjectId) =>
      currentSelectedObjectId !== null &&
      currentSelectedObjectId !== currentPedestrianId
        ? null
        : currentSelectedObjectId,
    );
  }, [currentPedestrianId]);

  useEffect(() => {
    const pedestrianBoxMaterial = pedestrianBoxMaterialRef.current;

    if (!pedestrianBoxMaterial) {
      return;
    }

    const isCurrentPedestrianSelected =
      selectedObjectId !== null && selectedObjectId === currentPedestrianId;

    pedestrianBoxMaterial.color.setHex(
      isCurrentPedestrianSelected
        ? PEDESTRIAN_SELECTED_COLOR
        : PEDESTRIAN_DEFAULT_COLOR,
    );
  }, [currentPedestrianId, selectedObjectId]);

  useEffect(() => {
    const vehicleBox = vehicleBoxRef.current;

    if (!vehicleBox) {
      return;
    }

    if (!selectedVehicleStateFrame) {
      vehicleBox.visible = false;
      return;
    }

    const [positionX, groundY, positionZ] =
      selectedVehicleStateFrame.position;
    const [width, length, height] = mockScenario.egoVehicleSize;

    vehicleBox.position.set(positionX, groundY + height / 2, positionZ);
    vehicleBox.scale.set(width, height, length);
    vehicleBox.rotation.set(0, selectedVehicleStateFrame.yawRadians, 0);
    vehicleBox.visible = true;
  }, [selectedVehicleStateFrame]);

  useEffect(() => {
    const trajectoryGeometry = trajectoryGeometryRef.current;
    const trajectoryPositionAttribute = trajectoryPositionAttributeRef.current;

    if (!trajectoryGeometry || !trajectoryPositionAttribute) {
      return;
    }

    if (!selectedTrajectoryFrame) {
      trajectoryGeometry.setDrawRange(0, 0);
      return;
    }

    const trajectoryPositions =
      trajectoryPositionAttribute.array as Float32Array;

    selectedTrajectoryFrame.points.forEach((point, index) => {
      const [positionX, positionY, positionZ] = point.position;
      const offset = index * 3;

      trajectoryPositions[offset] = positionX;
      trajectoryPositions[offset + 1] =
        positionY + TRAJECTORY_RENDER_HEIGHT;
      trajectoryPositions[offset + 2] = positionZ;
    });

    trajectoryPositionAttribute.needsUpdate = true;
    trajectoryGeometry.setDrawRange(
      0,
      selectedTrajectoryFrame.points.length,
    );
    trajectoryGeometry.computeBoundingSphere();
  }, [selectedTrajectoryFrame]);

  useEffect(() => {
    const collisionGeometry = collisionGeometryRef.current;
    const collisionPositionAttribute = collisionPositionAttributeRef.current;

    if (!collisionGeometry || !collisionPositionAttribute) {
      return;
    }

    if (!selectedTrajectoryFrame || !currentPedestrian) {
      collisionGeometry.setDrawRange(0, 0);
      return;
    }

    const collisionSegments = findAxisAlignedTrajectoryCollisionSegments(
      selectedTrajectoryFrame.points,
      currentPedestrian,
      mockScenario.egoVehicleSize,
    );
    const collisionPositions =
      collisionPositionAttribute.array as Float32Array;

    collisionSegments.forEach((segment, segmentIndex) => {
      const positions = [segment.start, segment.end];

      positions.forEach((position, endpointIndex) => {
        const [positionX, positionY, positionZ] = position;
        const offset = (segmentIndex * 2 + endpointIndex) * 3;

        collisionPositions[offset] = positionX;
        collisionPositions[offset + 1] = positionY + COLLISION_RENDER_HEIGHT;
        collisionPositions[offset + 2] = positionZ;
      });
    });

    collisionPositionAttribute.needsUpdate = true;
    collisionGeometry.setDrawRange(0, collisionSegments.length * 2);

    if (collisionSegments.length > 0) {
      collisionGeometry.computeBoundingSphere();
    }
  }, [currentPedestrian, selectedTrajectoryFrame]);

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
      <section className={styles.selectedObject} aria-label="선택한 객체 정보">
        <h2>선택한 객체</h2>
        {selectedObject ? (
          <dl className={styles.selectedObjectDetails}>
            <div>
              <dt>ID</dt>
              <dd>{selectedObject.id}</dd>
            </div>
            <div>
              <dt>종류</dt>
              <dd>{selectedObject.category === "pedestrian" ? "보행자" : "차량"}</dd>
            </div>
            <div>
              <dt>신뢰도</dt>
              <dd>{(selectedObject.confidence * 100).toFixed(0)}%</dd>
            </div>
            <div>
              <dt>크기 (너비 × 길이 × 높이)</dt>
              <dd>{selectedObject.size.map((value) => `${value.toFixed(1)}m`).join(" × ")}</dd>
            </div>
            <div>
              <dt>인식 시각</dt>
              <dd>{((selectedObjectDetectionFrame?.timestampMs ?? 0) / 1_000).toFixed(1)}초</dd>
            </div>
          </dl>
        ) : (
          <p>3D 장면에서 보행자 박스를 클릭하세요.</p>
        )}
      </section>
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
