"use client";

import { useEffect, useRef } from "react";
import { GridHelper, PerspectiveCamera, Scene, WebGLRenderer } from "three";
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
