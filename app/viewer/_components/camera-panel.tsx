import type { BufferedCameraFrame } from "../_hooks/use-buffered-camera-frame";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

type CameraPanelProps = {
  camera: BufferedCameraFrame;
  isActualData?: boolean;
};

export function CameraPanel({ camera, isActualData = false }: CameraPanelProps) {
  const { frame, activeSlot, imageRefs, status } = camera;
  const timestampSeconds = frame ? formatSeconds(frame.timestampMs) : null;
  const statusMessage =
    status === "loading"
      ? frame
        ? "다음 이미지 준비 중 · 이전 Frame 표시"
        : "이미지 불러오는 중"
      : status === "error"
        ? frame
          ? "이미지 로딩 실패 · 이전 Frame 표시"
          : "이미지를 불러오지 못했습니다."
        : status === "empty"
          ? "표시할 카메라 Frame이 없습니다."
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
      <div className={styles.cameraViewport} aria-busy={status === "loading"}>
        {([0, 1] as const).map((slot) => (
          <img
            key={slot}
            ref={(image) => {
              imageRefs.current[slot] = image;
            }}
            className={styles.cameraImage}
            data-active={activeSlot === slot}
            aria-hidden={activeSlot !== slot}
            alt={
              activeSlot === slot
                ? `${isActualData ? "실제" : "가상"} 전방 카메라 ${timestampSeconds}초 장면`
                : ""
            }
            width={640}
            height={360}
          />
        ))}
        {statusMessage && (
          <p className={styles.cameraStatus} role="status">
            {statusMessage}
          </p>
        )}
        {frame && (
          <span className={styles.cameraChannel}>
            CAM_FRONT · {isActualData ? "nuScenes" : "MOCK"}
          </span>
        )}
      </div>
    </section>
  );
}
