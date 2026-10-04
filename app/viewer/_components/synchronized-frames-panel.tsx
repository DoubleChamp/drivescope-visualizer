import type {
  CameraFrame,
  LidarFrame,
  ObjectDetectionFrame,
  EgoPoseFrame,
} from "../_data/frame-types";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

type SynchronizedFramesPanelProps = {
  currentTimeMs: number;
  cameraFrame: CameraFrame | null;
  lidarFrame: LidarFrame | null;
  objectDetectionFrame: ObjectDetectionFrame | null;
  egoPoseFrame: EgoPoseFrame | null;
  isMockData: boolean;
};

const formatTimestampDifference = (differenceMs: number) =>
  `${differenceMs > 0 ? "+" : ""}${differenceMs.toLocaleString("ko-KR")}ms`;

export function SynchronizedFramesPanel({
  currentTimeMs,
  cameraFrame,
  lidarFrame,
  objectDetectionFrame,
  egoPoseFrame,
  isMockData,
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
    { label: "Camera", frame: cameraFrame, detail: cameraFrame ? "전방 이미지" : null },
    {
      label: "LiDAR",
      frame: lidarFrame,
      detail: lidarFrame
        ? `${lidarPointCount.toLocaleString("ko-KR")}개 포인트`
        : null,
    },
    isMockData
      ? { label: "Object Detection", frame: objectDetectionFrame, detail: objectSummary }
      : { label: "차량 위치", frame: egoPoseFrame, detail: egoPoseFrame ? "차량 위치와 방향" : null },
  ];

  return (
    <section className={styles.syncPanel} aria-labelledby="sync-title">
      <div className={styles.railPanelHeading}>
        <div>
          <p>04 · Sensor timing</p>
          <h2 id="sync-title">Frame 동기화</h2>
        </div>
        <span className={styles.frameBadge}>
          {formatSeconds(currentTimeMs)}초
        </span>
      </div>
      <dl className={styles.synchronizedFrames} aria-label="동기화된 Frame">
        {frames.map(({ label, frame, detail }) => (
          <div
            key={label}
            className={styles.synchronizedFrame}
            data-available={frame !== null}
          >
            <dt>
              <span aria-hidden="true" />
              {label}
            </dt>
            <dd>
              {frame === null ? (
                "Frame 없음"
              ) : (
                <>
                  <span className={styles.frameTimestamp}>
                    {formatSeconds(frame.timestampMs)}초
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
      <p className={styles.panelNote}>
        시간 차이는 표시된 Frame과 재생 시각의 차이입니다. 센서별 수집 시각은
        다를 수 있습니다.
      </p>
    </section>
  );
}
