import styles from "../home.module.css";

const decisions = [
  {
    number: "01", label: "데이터 재사용", title: "한 번 읽은 프레임은 다시 사용합니다",
    problem: "타임라인을 앞뒤로 움직일 때 같은 파일을 매번 읽으면 다운로드와 좌표 준비가 반복됩니다.",
    decision: "최근 프레임을 최대 5개 보관하고, 오래 사용하지 않은 것부터 비웁니다. 같은 프레임의 요청은 공유하며 현재 프레임을 읽은 뒤에는 양옆 프레임도 미리 준비합니다.",
    evidence: "이미 보관한 프레임을 다시 선택하면 파일을 읽는 작업이 생략되는 것을 확인했습니다.",
  },
  {
    number: "02", label: "3D 표시", title: "좌표가 바뀌어도 표시 공간은 유지합니다",
    problem: "점군이 바뀔 때마다 3D 객체와 좌표 저장 공간을 새로 만들면 생성과 해제 작업이 반복됩니다.",
    decision: "처음 확보한 GPU 버퍼에 새 좌표를 넣고, 실제 포인트 수에 맞춰 그릴 범위만 바꿉니다. 프레임을 보관하는 CPU 캐시와 화면에 표시하는 GPU 버퍼는 각각 관리합니다.",
    evidence: "센서 프레임이 교체되어도 기존 표시 버퍼를 사용하는 구조로 연결했습니다.",
  },
  {
    number: "03", label: "카메라 사진", title: "다음 사진이 준비되면 화면을 교체합니다",
    problem: "사진 주소만 바로 바꾸면 새 이미지가 내려받아지고 해석되는 동안 화면이 비어 보일 수 있습니다.",
    decision: "현재 사진을 보여주는 공간과 다음 사진을 준비하는 공간을 따로 둡니다. 준비가 끝나면 사진과 기록 시각을 함께 바꿉니다.",
    evidence: "빠르게 시각을 옮겨도 늦게 준비된 이전 사진이 새 화면을 덮어쓰지 않는지 검사했습니다. 로딩이 실패하면 기존 사진과 재시도 버튼을 유지합니다.",
  },
];

export function ProjectOptimizations() {
  return (
    <section id="optimizations" className={styles.section} aria-labelledby="optimizations-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>02 · 문제 해결</p><h2 id="optimizations-title">재생 화면을 안정적으로 유지하는 방법</h2></div>
      </div>
      <p className={styles.sectionIntro}>데이터를 다시 읽는 비용과 화면을 새로 만드는 작업을 줄였습니다.
        다음 프레임을 준비하는 동안에도 현재 표시를 유지하도록 설계했습니다.</p>
      <div className={styles.decisions}>
        {decisions.map(item => (
          <article className={styles.decision} key={item.number}>
            <div className={styles.decisionHeading}>
              <span className={styles.decisionNumber}>{item.number}</span>
              <span className={styles.miniLabel}>{item.label}</span>
              <h3>{item.title}</h3>
            </div>
            <div className={styles.decisionBody}>
              <p><strong>어떤 문제가 있었나</strong>{item.problem}</p>
              <p><strong>어떻게 해결했나</strong>{item.decision}</p>
              <p className={styles.decisionEvidence}><strong>확인한 결과</strong>{item.evidence}</p>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.lifecycleNote}>
        <span className={styles.miniLabel}>화면을 떠날 때</span>
        <p><strong>만든 리소스는 사용이 끝나면 정리합니다.</strong> 모드를 바꾸거나 Viewer를 떠나면 이전 렌더링과 이벤트 처리를 멈추고 GPU 리소스를 해제합니다.
          늦게 완료된 요청도 현재 화면의 데이터인지 확인합니다.</p>
      </div>
    </section>
  );
}
