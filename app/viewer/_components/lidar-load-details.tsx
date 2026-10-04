import type { LidarLoadMeasurement } from "../_data/lidar-frame-source";
import type { LidarCacheStatus } from "../_hooks/use-lidar-frame-cache";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

type LidarLoadDetailsProps = {
  measurement: LidarLoadMeasurement | null;
  prefetchMeasurements: readonly LidarLoadMeasurement[];
  status: LidarCacheStatus;
};

function LoadMeasurement({
  measurement,
  role,
}: {
  measurement: LidarLoadMeasurement;
  role: "current" | "prefetch";
}) {
  const timings = measurement.timings;
  if (!timings) return null;

  const rows = [
    ["응답 헤더까지", timings.responseHeadersMs],
    ["응답 본문 읽기", timings.responseBodyMs],
    ["좌표 배열 준비", timings.preparePositionsMs],
    ["전체 로딩", measurement.loadDurationMs],
  ] as const;

  return (
    <div
      className={styles.loadMeasurement}
      data-lidar-load-role={role}
      data-measurement={JSON.stringify(measurement)}
    >
      <h4>{formatSeconds(measurement.timestampMs)}초 Frame</h4>
      <p>{measurement.requestKind === "prefetch"
        ? role === "current" ? "진행 중 prefetch 공유" : "prefetch가 시작한 요청"
        : "현재 Frame이 시작한 요청"}</p>
      <dl>{rows.map(([label, duration]) => (
        <div key={label}><dt>{label}</dt><dd>{duration.toFixed(2)}ms</dd></div>
      ))}</dl>
    </div>
  );
}

export function LidarLoadDetails({
  measurement,
  prefetchMeasurements,
  status,
}: LidarLoadDetailsProps) {
  return (
    <details className={styles.loadDetails} data-lidar-cache-status={status}>
      <summary>LiDAR 로딩 구간 자세히 보기</summary>
      <p className={styles.loadScope}>
        성공한 요청의 브라우저 경과 시간입니다. 헤더까지는 서버 처리·네트워크 대기를 포함하고,
        본문 읽기는 남은 다운로드·ArrayBuffer 준비를 포함합니다. GPU·React·이미지 시간은 제외합니다.
      </p>
      <h3>현재 표시 Frame</h3>
      {measurement ? (
        <LoadMeasurement measurement={measurement} role="current" />
      ) : (
        <p className={styles.loadScope}>{status === "hit"
          ? "캐시로 생략 · 새 로더를 실행하지 않았습니다."
          : status === "loading" ? "측정 중"
          : status === "error" ? "로딩 실패 · 성공한 측정값이 없습니다."
          : "Frame을 선택하면 측정합니다."}</p>
      )}
      <h3>마지막으로 완료된 주변 prefetch</h3>
      <div className={styles.prefetchLoads}>
        {prefetchMeasurements.length > 0
          ? prefetchMeasurements.map((sample) => (
            <LoadMeasurement key={`${sample.timestampMs}:${sample.startedAtMs}`} measurement={sample} role="prefetch" />
          ))
          : <p className={styles.loadScope}>완료된 prefetch 측정이 없습니다.</p>}
      </div>
      <p className={styles.loadScope}>
        공유된 요청은 최초 시작부터 잽니다. 각 구간 합계와 전체 시간의 차이에는 URL 준비·캐시 저장·Promise 처리도 들어갑니다.
        좌표 배열 준비는 크기 검사와 Float32Array 해석이며, little-endian에서는 배열을 복사하지 않습니다.
      </p>
    </details>
  );
}
