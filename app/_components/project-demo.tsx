import Link from "next/link";
import styles from "../home.module.css";

const chapters = [
  ["00:05", "실제 센서 재생", "점군·전방 사진·차량 위치를 재생하고 12.4초로 탐색합니다."],
  ["00:18", "가상 급제동 분석", "보행자 등장·인식·객체 선택과 급제동 전후의 예상 경로를 비교합니다."],
  ["00:38", "센서 시각 비교", "12.4초 재생 시각에서 12.0초 센서 Frame과 -400ms 차이를 확인합니다."],
  ["00:48", "캐시와 사진 교체", "캐시된 LiDAR 재사용과 브라우저 디코딩이 끝난 뒤의 사진 교체를 보여줍니다."],
];

export function ProjectDemo() {
  return (
    <section id="demo" className={styles.section} aria-labelledby="demo-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>직접 살펴보기</p><h2 id="demo-title">실제 화면을 1분에 담았습니다</h2></div>
        <p className={styles.headingAside}>60초 · 한글 자막<br />실제 공개 Viewer 촬영</p>
      </div>
      <div className={styles.demoGrid}>
        <div className={styles.videoPanel}>
          <video className={styles.video} controls playsInline preload="none" width={1920} height={1080}
            poster="/demo/drivescope-demo-poster.jpg?v=2" aria-label="DriveScope 1분 프로젝트 데모, 한국어 자막 포함">
            <source src="/demo/drivescope-demo.mp4?v=2" type="video/mp4" />
            <p><a href="/demo/drivescope-demo.mp4?v=2">MP4 파일로 데모 영상 보기</a></p>
          </video>
          <div className={styles.videoFooter}><span>한글 자막 포함 · 전체 화면으로도 볼 수 있습니다</span><a href="/demo/drivescope-demo.mp4?v=2" download>영상 다운로드 ↓</a></div>
        </div>
        <aside className={styles.demoScope} aria-label="데모 데이터 범위">
          <div><span className={styles.scopeBadge}>실제 데이터</span><h3>센서 로그를 탐색</h3><p>nuScenes mini의 LiDAR·전방 카메라·차량 위치를 연결했습니다.</p></div>
          <div><span className={styles.mockBadge}>가상 시나리오</span><h3>문제 장면의 시간 관계 분석</h3><p>보행자 인식·예상 경로·충돌 구간·급제동은 가상 데이터로 검증했습니다.</p></div>
          <p className={styles.scopeNote}>실제 로그에 객체 인식·Planning·급제동 이벤트를 연결하는 작업은 남아 있습니다.</p>
        </aside>
      </div>
      <details className={styles.chapters}>
        <summary>영상 설명을 텍스트로 읽기</summary>
        <ol>{chapters.map(([time, title, text]) => <li key={time}><span>{time}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>
      </details>
      <div className={styles.exploreCta}>
        <div><h3>센서 로그를 Viewer에서 확인하세요</h3><p>실제 로그를 탐색하거나 가상 10 → 11 → 12 → 12.4초를 비교해 보세요.</p></div>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/viewer" prefetch={false}>Viewer 열기 <span aria-hidden="true">↗</span></Link>
          <a className={styles.secondaryLink} href="https://github.com/DoubleChamp/drivescope-visualizer">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  );
}
