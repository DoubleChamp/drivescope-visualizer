import { FrameSelectionDemo } from "./frame-selection-demo";
import styles from "../home.module.css";

const stages = [
  { title: "전처리", tool: "Python CLI", text: "센서 보정·ego pose 적용, 좌표 변환과 상대 시간 정규화", detail: "오프라인에서 한 번", tone: "violet" },
  { title: "데이터 계약", tool: "manifest + assets", text: "v3 메타데이터, Float32 좌표 파일과 전방 JPEG", detail: "schema · timestamp · byte size", tone: "violet" },
  { title: "필요한 Frame 로드", tool: "Browser loader", text: "공개 Blob의 manifest를 읽고 목표·주변 Frame만 요청", detail: "전체 센서 선다운로드 생략", tone: "cyan" },
  { title: "CPU 캐시", tool: "Map + Promise", text: "진행 중 요청 공유, 양옆 prefetch와 최대 5개 LRU", detail: "완료된 Float32Array 보관", tone: "cyan" },
  { title: "GPU 표시", tool: "Three.js · WebGL", text: "기존 position Buffer를 갱신하고 rAF에서 렌더링", detail: "set · needsUpdate · drawRange", tone: "green" },
];

export function ProjectArchitecture() {
  return (
    <section id="architecture" className={styles.section} aria-labelledby="architecture-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>01 · 데이터 구조</p><h2 id="architecture-title">원본 로그에서 화면까지</h2></div>
        <a className={styles.textLink} href="https://github.com/DoubleChamp/drivescope-visualizer/blob/main/docs/ARCHITECTURE.md">아키텍처 문서 <span aria-hidden="true">↗</span></a>
      </div>
      <p className={styles.sectionIntro}>센서의 시간·좌표·파일 형식을 렌더링 코드에 직접 섞으면 데이터 오류와 화면 오류를 구분하기 어렵습니다.
        전처리·검증·로딩·캐시·표시를 나누어 문제를 추적할 수 있는 흐름으로 만들었습니다.</p>
      <figure className={styles.pipeline}>
        <figcaption><span>처리 흐름</span><span>디스크 계약 → CPU 메모리 → GPU 리소스</span></figcaption>
        <ol className={styles.pipelineStages}>
          {stages.map((stage, index) => (
            <li key={stage.title} data-tone={stage.tone}>
              <span className={styles.stageIndex}>{String(index + 1).padStart(2, "0")}</span>
              <h3>{stage.title}</h3><span className={styles.stageTool}>{stage.tool}</span>
              <p>{stage.text}</p><small>{stage.detail}</small>
            </li>
          ))}
        </ol>
        <div className={styles.responsibilitySplit}>
          <p><span>REACT</span>입력 · 재생 시계 · 선택 · 로딩 상태 · DOM</p>
          <p><span>THREE.JS</span>Scene · Camera · Buffer · 렌더 루프 · cleanup</p>
        </div>
      </figure>
      <div className={styles.contractRow}>
        <div className={styles.contractNote}>
          <span className={styles.miniLabel}>좌표 계약</span>
          <h3>좌우 반전을 좌표 계약에서 해결</h3>
          <p>원본 축을 그대로 화면에 옮기지 않고 센서 보정과 차량 pose를 적용합니다.
            전방을 −Z로 통일한 <code>[-y, z, -x]</code> 변환으로 오른손 좌표계를 유지했습니다.</p>
          <a className={styles.textLink} href="https://github.com/DoubleChamp/drivescope-visualizer/blob/main/scripts/convert_nuscenes_mini.py">변환기 코드 <span aria-hidden="true">↗</span></a>
        </div>
        <div className={styles.contractNote}>
          <span className={styles.miniLabel}>바이너리 계약</span>
          <h3>파일 크기를 계약으로 검증</h3>
          <p>좌표는 <code>float32-le-xyz</code>로 저장합니다. 브라우저는 파일 크기가
            <code> pointCount × 3 × 4</code>바이트인지 검사하고, little-endian 환경에서는 ArrayBuffer를 Float32Array 뷰로 해석합니다.</p>
          <a className={styles.textLink} href="https://github.com/DoubleChamp/drivescope-visualizer/blob/main/app/viewer/_data/load-drivescope-data-source.ts">로더 코드 <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div className={styles.syncRow}>
        <div className={styles.syncCopy}>
          <p className={styles.eyebrow}>시간 동기화</p>
          <h3>같은 재생 시각이<br />같은 수집 시각은 아닙니다.</h3>
          <p>각 센서는 <strong>재생 시각 이하의 최신 Frame</strong>을 선택합니다.
            목표 시각과 실제 표시한 Frame의 시각을 함께 보여주어, 수집 주기의 차이를 분석 정보로 남깁니다.</p>
          <a className={styles.textLink} href="https://github.com/DoubleChamp/drivescope-visualizer/blob/main/app/viewer/_data/find-latest-frame-at-or-before.ts">Viewer와 같은 선택 함수 <span aria-hidden="true">↗</span></a>
        </div>
        <FrameSelectionDemo />
      </div>
    </section>
  );
}
