import { FrameSelectionDemo } from "./frame-selection-demo";
import styles from "../home.module.css";

const stages = [
  { title: "원본 데이터를 준비합니다", text: "센서마다 다른 좌표를 차량 기준으로 맞추고, 기록 시각을 재생에 사용할 상대 시간으로 바꿉니다." },
  { title: "파일 정보를 검증합니다", text: "센서 목록과 시각, 포인트 수를 확인합니다. 좌표 파일의 크기가 기록된 정보와 일치하는지도 검사합니다." },
  { title: "필요한 데이터만 읽습니다", text: "모든 센서 파일을 처음에 내려받지 않습니다. 지금 표시할 프레임과 주변 프레임을 요청합니다." },
  { title: "읽은 데이터를 재사용합니다", text: "최근에 준비한 프레임을 최대 5개 보관합니다. 같은 프레임을 동시에 요청하면 진행 중인 작업을 공유합니다." },
  { title: "준비한 좌표를 화면에 표시합니다", text: "Three.js가 기존 GPU 버퍼의 좌표를 갱신하고 3D 장면을 그립니다. 프레임마다 표시 공간을 새로 만들지 않습니다." },
];

export function ProjectArchitecture() {
  return (
    <section id="architecture" className={styles.section} aria-labelledby="architecture-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>01 · 데이터 흐름</p><h2 id="architecture-title">원본 로그가 화면에 도착하기까지</h2></div>
        <a className={styles.textLink} href="https://github.com/DoubleChamp/drivescope-visualizer/blob/main/docs/ARCHITECTURE.md">구조 설명 문서 <span aria-hidden="true">↗</span></a>
      </div>
      <p className={styles.sectionIntro}>원본 센서 기록은 시간과 좌표, 파일 형식이 서로 다릅니다.
        데이터를 준비하는 과정과 화면에 그리는 과정을 나누어, 문제가 생겼을 때 어느 단계에서 발생했는지 확인할 수 있게 했습니다.</p>
      <figure className={styles.pipeline}>
        <figcaption>데이터 준비 → 필요한 프레임 읽기 → 3D 화면 표시</figcaption>
        <ol className={styles.pipelineStages}>
          {stages.map((stage, index) => (
            <li key={stage.title}>
              <span className={styles.stageIndex}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{stage.title}</h3><p>{stage.text}</p>
            </li>
          ))}
        </ol>
        <div className={styles.responsibilitySplit}>
          <p><span>React</span>사용자 입력, 재생 시각과 화면 상태를 관리합니다.</p>
          <p><span>Three.js</span>3D 장면을 그리고 GPU 리소스를 관리합니다.</p>
        </div>
      </figure>
      <div className={styles.contractRow}>
        <div className={styles.contractNote}>
          <span className={styles.miniLabel}>좌표 맞추기</span>
          <h3>센서와 화면의 좌우 방향을 일치시킵니다</h3>
          <p>센서의 장착 위치·방향과 기록 당시의 차량 위치를 함께 적용합니다.
            화면의 전방·높이·좌우 기준을 통일해 사진과 점군을 비교할 수 있게 합니다.</p>
        </div>
        <div className={styles.contractNote}>
          <span className={styles.miniLabel}>파일 확인하기</span>
          <h3>잘못된 좌표 파일은 표시 전에 확인합니다</h3>
          <p>점 하나는 세 방향의 좌표로 저장됩니다. 파일에 들어 있는 좌표 수와 기록된 포인트 수를 비교해,
            누락되거나 형식이 맞지 않는 데이터를 검증 단계에서 찾아냅니다.</p>
        </div>
      </div>
      <div className={styles.syncRow}>
        <div className={styles.syncCopy}>
          <p className={styles.eyebrow}>시간 맞추기</p>
          <h3>같은 장면을 봐도 센서의 기록 시각은 다릅니다</h3>
          <p>센서마다 수집 주기가 다르므로 <strong>현재 재생 시각까지 기록된 가장 최근 프레임</strong>을 표시합니다.</p>
          <p>예를 들어 12.4초를 재생할 때, 1초 주기의 카메라는 12.0초 사진을 보여줍니다.
            화면에는 재생 시각과 사진의 기록 시각을 함께 표시합니다.</p>
        </div>
        <FrameSelectionDemo />
      </div>
    </section>
  );
}
