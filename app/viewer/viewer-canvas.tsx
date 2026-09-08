"use client";

import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  GridHelper,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
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

    const pointPositions: Vector3[] = [];

    // 격자 위에 10행 × 10열의 가상 좌표를 배치한다.
    for (let row = 0; row < 10; row += 1) {
      for (let column = 0; column < 10; column += 1) {
        pointPositions.push(
          new Vector3((column - 4.5) * 0.5, 0.25, (row - 4.5) * 0.5),
        );
      }
    }

    const pointsGeometry = new BufferGeometry().setFromPoints(pointPositions);
    const pointsMaterial = new PointsMaterial({ color: 0xffc857, size: 0.1 });
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
