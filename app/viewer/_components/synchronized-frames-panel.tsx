import type {
  CameraFrame,
  LidarFrame,
  ObjectDetectionFrame,
} from "../_data/frame-types";
import styles from "../viewer-canvas.module.css";

type SynchronizedFramesPanelProps = {
  currentTimeMs: number;
  cameraFrame: CameraFrame | null;
  lidarFrame: LidarFrame | null;
  objectDetectionFrame: ObjectDetectionFrame | null;
};

const formatTimestampDifference = (differenceMs: number) =>
  `${differenceMs > 0 ? "+" : ""}${differenceMs.toLocaleString("ko-KR")}ms`;

export function SynchronizedFramesPanel({
  currentTimeMs,
  cameraFrame,
  lidarFrame,
  objectDetectionFrame,
}: SynchronizedFramesPanelProps) {
  const lidarPointCount = lidarFrame ? lidarFrame.positions.length / 3 : 0;
  const objectSummary = objectDetectionFrame
    ? objectDetectionFrame.objects.length === 0
      ? "객체 없음"
      : objectDetectionFrame.objects
          .map((object) => `${object.id} (${object.category})`)
          .join(", ")
    : null;
  const frames = [
    { label: "Camera", frame: cameraFrame, detail: cameraFrame?.imageUrl ?? null },
    {
      label: "LiDAR",
      frame: lidarFrame,
      detail: lidarFrame
        ? `${lidarPointCount.toLocaleString("ko-KR")}개 포인트`
        : null,
    },
    {
      label: "Object Detection",
      frame: objectDetectionFrame,
      detail: objectSummary,
    },
  ];

  return (
    <dl className={styles.synchronizedFrames} aria-label="동기화된 Frame">
      {frames.map(({ label, frame, detail }) => (
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
                    {formatTimestampDifference(frame.timestampMs - currentTimeMs)}
                  </span>
                </span>
                <span className={styles.frameDetail}>{detail}</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
