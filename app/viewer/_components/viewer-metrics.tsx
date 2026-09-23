import styles from "../viewer-canvas.module.css";

type ViewerMetricsProps = {
  pointCount: number;
  framesPerSecond: number | null;
  currentTimeMs: number;
  durationMs: number;
};

export function ViewerMetrics({
  pointCount,
  framesPerSecond,
  currentTimeMs,
  durationMs,
}: ViewerMetricsProps) {
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
          {(currentTimeMs / 1_000).toFixed(1)} /{" "}
          {(durationMs / 1_000).toFixed(1)}초
        </dd>
      </div>
    </dl>
  );
}
