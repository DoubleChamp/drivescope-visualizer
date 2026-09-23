import type { CameraFrame } from "../_data/frame-types";
import styles from "../viewer-canvas.module.css";

type CameraPanelProps = {
  frame: CameraFrame | null;
};

export function CameraPanel({ frame }: CameraPanelProps) {
  const timestampSeconds = frame
    ? (frame.timestampMs / 1_000).toFixed(1)
    : null;

  return (
    <section className={styles.cameraPanel} aria-label="전방 카메라">
      <div className={styles.cameraPanelHeading}>
        <h2>전방 카메라 · 가상 장면</h2>
        <span>{frame ? `촬영 ${timestampSeconds}초` : "Frame 없음"}</span>
      </div>
      {frame ? (
        <img
          className={styles.cameraImage}
          src={frame.imageUrl}
          alt={`가상 전방 카메라 ${timestampSeconds}초 장면`}
          width={640}
          height={360}
        />
      ) : (
        <p>표시할 카메라 Frame이 없습니다.</p>
      )}
    </section>
  );
}
