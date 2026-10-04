import styles from "../home.module.css";

const decisions = [
  {
    number: "01", label: "NETWORK / CPU", title: "한 번 읽은 Frame은 다시 사용",
    problem: "탐색과 prefetch가 같은 Frame을 요청하면 파일 읽기와 배열 준비가 중복됩니다.",
    decision: "timestamp별 진행 중 Promise를 공유하고, 완료된 Frame은 최대 5개 LRU 캐시에 보관합니다. 현재 Frame 로딩 후 양옆 Frame을 준비합니다.",
    evidence: "반복 탐색에서 cache hit와 로더 호출 생략을 확인했습니다.",
    code: "const cachedFrame = cache.get(timestampMs);\nif (cachedFrame) {\n  return Promise.resolve({ frame: cachedFrame, loadDurationMs: null });\n}\nconst inFlightLoad = inFlightLoads.get(timestampMs);\nif (inFlightLoad) return inFlightLoad;",
    file: "use-lidar-frame-cache.ts", href: "app/viewer/_hooks/use-lidar-frame-cache.ts",
  },
  {
    number: "02", label: "GPU / ALLOCATION", title: "좌표가 바뀌어도 Buffer는 유지",
    problem: "Frame마다 Geometry와 Attribute를 만들면 할당·업로드·해제 작업이 반복됩니다.",
    decision: "런타임 생성 시 position Buffer를 확보하고, 새 좌표를 기존 배열에 복사합니다. 실제 포인트 수만큼 drawRange를 갱신합니다.",
    evidence: "CPU Frame 캐시와 GPU 표시 Buffer의 수명과 역할을 분리했습니다.",
    code: "(attribute.array as Float32Array).set(lidarFrame.positions);\nattribute.needsUpdate = true;\ngeometry.setDrawRange(0, lidarFrame.positions.length / 3);",
    file: "use-three-viewer.ts", href: "app/viewer/_hooks/use-three-viewer.ts",
  },
  {
    number: "03", label: "IMAGE / DISPLAY", title: "사진은 준비가 끝난 뒤 교체",
    problem: "새 URL을 지정한 순간에는 다운로드와 JPEG 디코딩이 끝나지 않아 화면이 빌 수 있습니다.",
    decision: "두 img 슬롯을 번갈아 사용합니다. 보이는 사진을 유지하고 숨긴 img에서 decode()가 끝나면 표시 슬롯과 timestamp를 함께 바꿉니다.",
    evidence: "빠른 seek에서 오래된 decode 완료를 무시하고, 실패 시 기존 사진과 재시도 입력을 유지합니다.",
    code: "image.src = targetFrame.imageUrl;\nvoid image.decode().then(() => {\n  if (cancelled) return;\n  activeSlotRef.current = nextSlot;\n  setDisplayed({ sourceId, frame: targetFrame, slot: nextSlot });\n});",
    file: "use-buffered-camera-frame.ts", href: "app/viewer/_hooks/use-buffered-camera-frame.ts",
  },
];

export function ProjectOptimizations() {
  return (
    <section id="optimizations" className={styles.section} aria-labelledby="optimizations-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>02 / ENGINEERING DECISIONS</p><h2 id="optimizations-title">반복되는 비용을 찾아,<br />재사용할 경계를 정했습니다.</h2></div>
        <p className={styles.headingAside}>요청 · 메모리 · 표시<br />각기 다른 수명의 데이터</p>
      </div>
      <div className={styles.decisions}>
        {decisions.map(item => (
          <article className={styles.decision} key={item.number}>
            <div className={styles.decisionHeading}><span className={styles.decisionNumber}>{item.number}</span><span className={styles.miniLabel}>{item.label}</span></div>
            <h3>{item.title}</h3>
            <p className={styles.problemText}>{item.problem}</p>
            <p>{item.decision}</p>
            <div className={styles.decisionEvidence}><span aria-hidden="true">↳</span>{item.evidence}</div>
            <details className={styles.codeDetails}>
              <summary>핵심 코드 보기</summary>
              <pre><code>{item.code}</code></pre>
              <a className={styles.textLink} href={`https://github.com/DoubleChamp/drivescope-visualizer/blob/main/${item.href}`}>{item.file} <span aria-hidden="true">↗</span></a>
            </details>
          </article>
        ))}
      </div>
      <div className={styles.lifecycleNote}>
        <span className={styles.miniLabel}>RESOURCE LIFECYCLE</span>
        <p><strong>생성과 해제는 같은 런타임이 맡습니다.</strong> 모드 전환과 unmount에서 rAF·이벤트를 정리하고 Geometry·Material·Renderer를 dispose합니다.
          늦게 끝난 요청이 새 화면을 덮어쓰지 않도록 완료 결과도 검사합니다.</p>
      </div>
    </section>
  );
}
