import styles from "../viewer-canvas.module.css";
import type { LidarCacheStatus } from "../_hooks/use-lidar-frame-cache";
import { formatSeconds } from "../_utils/format-time";

type ViewerMetricsProps = {
  pointCount: number;
  framesPerSecond: number | null;
  currentTimeMs: number;
  durationMs: number;
  lidarCacheStatus: LidarCacheStatus;
  cachedLidarFrameCount: number;
  lidarCacheCapacity: number;
  lidarLoadDurationMs: number | null;
};

const CACHE_STATUS_LABELS: Record<LidarCacheStatus, string> = {
  empty: "Frame 없음",
  loading: "로딩 중",
  hit: "hit · 재사용",
  miss: "miss · 모의 로딩",
};

export function ViewerMetrics({
  pointCount,
  framesPerSecond,
  currentTimeMs,
  durationMs,
  lidarCacheStatus,
  cachedLidarFrameCount,
  lidarCacheCapacity,
  lidarLoadDurationMs,
}: ViewerMetricsProps) {
  const lidarLoadDurationLabel =
    lidarCacheStatus === "hit"
      ? "캐시로 생략"
      : lidarCacheStatus === "loading"
        ? "측정 중"
        : lidarLoadDurationMs === null
          ? "Frame 없음"
          : `${lidarLoadDurationMs.toFixed(2)}ms`;

  return (
    <dl className={styles.metrics} aria-label="뷰어 통계">
      <div className={styles.metric}>
        <dt>포인트 수</dt>
        <dd>{pointCount.toLocaleString("ko-KR")}</dd>
      </div>
      <div className={styles.metric}>
        <dt>FPS</dt>
        <dd>{framesPerSecond ?? "측정 중"}</dd>
      </div>
      <div className={styles.metric}>
        <dt>재생 시간</dt>
        <dd>
          {formatSeconds(currentTimeMs)} / {formatSeconds(durationMs)}초
        </dd>
      </div>
      <div className={styles.metric}>
        <dt>LiDAR 캐시</dt>
        <dd>
          {CACHE_STATUS_LABELS[lidarCacheStatus]} · {cachedLidarFrameCount}/
          {lidarCacheCapacity}개
        </dd>
      </div>
      <div className={styles.metric}>
        <dt>Frame 로딩</dt>
        <dd>{lidarLoadDurationLabel}</dd>
      </div>
    </dl>
  );
}
