"use client";

import { useEffect, useRef } from "react";
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
import styles from "./viewer-canvas.module.css";

export default function ViewerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const pointsPerSide = 100;
    const pointCount = pointsPerSide * pointsPerSide;
    const pointSpacing = 0.1;
    const halfExtent = ((pointsPerSide - 1) * pointSpacing) / 2;
    const pointPositions = new Float32Array(pointCount * 3);

    // 격자 위에 100행 × 100열의 가상 좌표를 배치한다.
    for (let row = 0; row < pointsPerSide; row += 1) {
      for (let column = 0; column < pointsPerSide; column += 1) {
        const pointIndex = row * pointsPerSide + column;
        const offset = pointIndex * 3;

        pointPositions[offset] = column * pointSpacing - halfExtent;
        pointPositions[offset + 1] = 0.25;
        pointPositions[offset + 2] = row * pointSpacing - halfExtent;
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
    const renderFrame = () => {
      renderer.render(scene, camera);
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

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-label="DriveScope 3D 뷰어"
    />
  );
}
