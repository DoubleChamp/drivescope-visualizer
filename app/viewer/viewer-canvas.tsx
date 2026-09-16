"use client";

import { useEffect, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  GridHelper,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from "three";
import { mockScenario } from "./_data/mock-scenario";
import styles from "./viewer-canvas.module.css";

const POINTS_PER_SIDE = 100;
const POINT_COUNT = POINTS_PER_SIDE * POINTS_PER_SIDE;
const POINT_SPACING = 0.1;
const FPS_SAMPLE_INTERVAL_MS = 1_000;
const INITIAL_PLAYBACK_TIME_MS = 0;
const PLAYBACK_UPDATE_INTERVAL_MS = 100;

export default function ViewerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackStartedAtRef = useRef(0);
  const playbackTimeAtStartRef = useRef(INITIAL_PLAYBACK_TIME_MS);
  const [framesPerSecond, setFramesPerSecond] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(
    INITIAL_PLAYBACK_TIME_MS,
  );
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scene = new Scene();
    const grid = new GridHelper(10, 10);
    const camera = new PerspectiveCamera(60, width / height, 0.1, 1000);

    scene.add(grid);

    const halfExtent = ((POINTS_PER_SIDE - 1) * POINT_SPACING) / 2;
    const pointPositions = new Float32Array(POINT_COUNT * 3);

    // 격자 위에 100행 × 100열의 가상 좌표를 배치한다.
    for (let row = 0; row < POINTS_PER_SIDE; row += 1) {
      for (let column = 0; column < POINTS_PER_SIDE; column += 1) {
        const pointIndex = row * POINTS_PER_SIDE + column;
        const offset = pointIndex * 3;

        pointPositions[offset] = column * POINT_SPACING - halfExtent;
        pointPositions[offset + 1] = 0.25;
        pointPositions[offset + 2] = row * POINT_SPACING - halfExtent;
      }
    }

    const pointsGeometry = new BufferGeometry();
    pointsGeometry.setAttribute(
      "position",
      new BufferAttribute(pointPositions, 3),
    );
    const pointsMaterial = new PointsMaterial({ color: 0x38bdf8, size: 0.06 });
    const points = new Points(pointsGeometry, pointsMaterial);

    scene.add(points);

    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

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
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      grid.dispose();
      scene.clear();
      renderer.dispose();
    };
  }, []);

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
          <dd>{POINT_COUNT.toLocaleString("ko-KR")}</dd>
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
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playbackButton}
          aria-pressed={isPlaying}
          onClick={handlePlaybackToggle}
        >
          {isPlaying ? "정지" : "재생"}
        </button>
        <label className={styles.timelineLabel}>
          <span>타임라인</span>
          <input
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
        </label>
      </div>
    </div>
  );
}
