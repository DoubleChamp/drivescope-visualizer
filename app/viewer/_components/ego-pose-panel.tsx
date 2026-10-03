import type { EgoPoseFrame } from "../_data/frame-types";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

type EgoPosePanelProps = {
  frame: EgoPoseFrame | null;
  isLoading: boolean;
};

export function EgoPosePanel({ frame, isLoading }: EgoPosePanelProps) {
  return (
    <section className={styles.selectedObject} aria-labelledby="ego-title">
      <div className={styles.railPanelHeading}>
        <div>
          <p>03 · Ego vehicle</p>
          <h2 id="ego-title">차량 위치</h2>
        </div>
        <span className={styles.frameBadge}>
          {frame ? `${formatSeconds(frame.timestampMs)}초` : "Frame 대기"}
        </span>
      </div>
      {frame ? (
        <>
          <dl className={styles.egoPoseDetails}>
            <div>
              <dt>X · 좌우 위치</dt>
              <dd>{frame.position[0].toFixed(2)}m</dd>
            </div>
            <div>
              <dt>Z · 앞뒤 위치</dt>
              <dd>{frame.position[2].toFixed(2)}m</dd>
            </div>
            <div>
              <dt>Y · 높이</dt>
              <dd>{frame.position[1].toFixed(2)}m</dd>
            </div>
            <div>
              <dt>방향각</dt>
              <dd>{((frame.yawRadians * 180) / Math.PI).toFixed(1)}°</dd>
            </div>
          </dl>
          <p className={styles.panelNote}>
            첫 LiDAR 차량 위치 기준입니다. 오른쪽은 +X, 전방은 -Z,
            방향각 0°는 -Z입니다.
          </p>
        </>
      ) : (
        <p className={styles.panelEmptyState}>
          {isLoading
            ? "차량 위치 데이터를 준비하고 있습니다."
            : "현재 시각까지 수집된 차량 위치 Frame이 없습니다. 재생하거나 타임라인을 이동하세요."}
        </p>
      )}
    </section>
  );
}
