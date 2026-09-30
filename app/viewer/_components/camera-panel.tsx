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
    <section className={styles.cameraPanel} aria-labelledby="camera-title">
      <div className={styles.cameraPanelHeading}>
        <div>
          <p>02 · Camera feed</p>
          <h2 id="camera-title">전방 카메라</h2>
        </div>
        <span className={styles.frameBadge}>
          {frame ? `${timestampSeconds}초` : "Frame 없음"}
        </span>
      </div>
      {frame ? (
        <div className={styles.cameraViewport}>
          <img
            className={styles.cameraImage}
            src={frame.imageUrl}
            alt={`가상 전방 카메라 ${timestampSeconds}초 장면`}
            width={640}
            height={360}
          />
          <span className={styles.cameraChannel}>CAM_FRONT · MOCK</span>
        </div>
      ) : (
        <p className={styles.panelEmptyState}>
          표시할 카메라 Frame이 없습니다.
        </p>
      )}
    </section>
  );
}
