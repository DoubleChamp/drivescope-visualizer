import { useEffect, useState } from "react";
import type { CameraFrame } from "../_data/frame-types";
import type { BufferedCameraFrame } from "../_hooks/use-buffered-camera-frame";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

type CameraPanelProps = {
  camera: BufferedCameraFrame;
  isActualData?: boolean;
  onRetry: () => void;
};

const CAMERA_DELAY_NOTICE_MS = 500;

export function CameraPanel({
  camera,
  isActualData = false,
  onRetry,
}: CameraPanelProps) {
  const { frame, activeSlot, imageRefs, status } = camera;
  const [delayedFrame, setDelayedFrame] = useState<CameraFrame | null>(null);

  useEffect(() => {
    setDelayedFrame(null);
    if (status !== "loading" || frame === null) return;

    // 같은 사진이 계속 표시되는 동안만 지연을 알린다. 목표 Frame 변경으로 타이머를 재시작하지 않는다.
    const timeoutId = window.setTimeout(() => {
      setDelayedFrame(frame);
    }, CAMERA_DELAY_NOTICE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [status, frame]);

  const showDelayNotice =
    status === "loading" && frame !== null && delayedFrame === frame;
  const timestampSeconds = frame ? formatSeconds(frame.timestampMs) : null;
  const statusMessage =
    status === "loading"
      ? frame
        ? null
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
        <div className={styles.cameraHeaderStatus}>
          <span
            className={styles.cameraDelayNotice}
            data-delayed={showDelayNotice}
            role="status"
          >
            {showDelayNotice ? "이미지 지연" : ""}
          </span>
          <span className={styles.frameBadge}>
            {frame ? `${timestampSeconds}초` : "Frame 없음"}
          </span>
        </div>
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
          <div className={styles.cameraStatus} role="status">
            <p>{statusMessage}</p>
            {status === "error" && (
              <>
                <p>이미지 파일이나 연결 상태를 확인한 뒤 다시 시도하세요.</p>
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={onRetry}
                >
                  이미지 다시 시도
                </button>
              </>
            )}
          </div>
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
