import styles from "../home.module.css";

export function ProjectResults() {
  return (
    <section id="results" className={styles.section} aria-labelledby="results-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>03 · 성능 측정</p><h2 id="results-title">측정 결과와 해석</h2></div>
      </div>
      <div className={styles.resultsGrid}>
        <div className={styles.measurements}>
          <div className={styles.measurementHeader}><span className={styles.miniLabel}>로컬 기준선 · 2026.10.03</span><span>각 모드 3회</span></div>
          <table className={styles.resultsTable}>
            <caption>같은 브라우저·탐색 순서로 비교한 가상·실제 nuScenes 기준선</caption>
            <thead><tr><th scope="col">측정 항목</th><th scope="col">가상</th><th scope="col">실제</th></tr></thead>
            <tbody>
              <tr>
                <th scope="row">포인트 수</th>
                <td>15~21</td>
                <td className={styles.pointRange}><span>34,688</span>~<wbr /><span>34,752</span></td>
              </tr>
              <tr><th scope="row">로딩 중앙값</th><td>0.3ms</td><td className={styles.highlightValue}>13.9ms</td></tr>
              <tr><th scope="row">로딩 표본 수</th><td>15개</td><td>15개</td></tr>
              <tr><th scope="row">FPS 중앙값</th><td>75</td><td>75</td></tr>
              <tr><th scope="row">캐시 재사용</th><td>3/3회</td><td className={styles.highlightValue}>3/3회</td></tr>
            </tbody>
          </table>
          <p className={styles.measurementEnvironment}>로딩 시간은 새로 읽은 프레임의 측정값입니다.<br />Windows · production build · Chrome 154 · GTX 1050 Ti<br />1440×1400 viewport · HTTP 캐시 비활성 · CPU LRU/prefetch 유지</p>
        </div>
        <div className={styles.measurementMeaning}>
          <span className={styles.miniLabel}>측정 구간</span>
          <h3><span>13.9ms</span>는<br />데이터 요청부터 좌표 준비까지입니다.</h3>
          <p>HTTP 응답 대기, 파일 전송과 좌표 준비를 포함한 시간입니다.
            GPU 업로드·React 화면 반영·이미지 디코딩은 이 측정 구간에 포함되지 않습니다.</p>
          <div className={styles.measurementRange}><span>요청 시작</span><i /><span>좌표 배열 준비</span></div>
          <p className={styles.measurementCaveat}>두 모드의 초기 기준선이며 최적화 전후의 향상률 측정은 아닙니다.
            FPS 75는 3D 화면을 그리는 호출 빈도이며 센서 수집 주기와는 다릅니다. 장시간 메모리·GPU 시간·원격 네트워크는 후속 측정 대상입니다.</p>
        </div>
      </div>
      <div className={styles.validation}>
        <div><span className={styles.miniLabel}>동작 검증</span><h3>성공 경로와 복구 경로를 함께 검사</h3></div>
        <ul>
          <li><span aria-hidden="true">✓</span>공개 데이터 79개 · 원본 일치와 브라우저 접근 확인</li>
          <li><span aria-hidden="true">✓</span>빠른 시각 이동 · 늦은 로딩 완료 · 재시도 · 모드 전환</li>
          <li><span aria-hidden="true">✓</span>이전 3D 화면의 렌더링 중지 · GPU 리소스 해제</li>
          <li><span aria-hidden="true">✓</span>320px·390px 브라우저 viewport · 키보드 입력</li>
        </ul>
      </div>
    </section>
  );
}
