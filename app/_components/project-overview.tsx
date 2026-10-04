import Image from "next/image";
import Link from "next/link";
import demoPoster from "../../public/demo/drivescope-demo-poster.jpg";
import styles from "../home.module.css";

export function ProjectOverview() {
  return (
    <section className={styles.hero} aria-labelledby="project-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>데이터 처리 · 성능 측정</p>
        <h1 id="project-title">DriveScope</h1>
        <p className={styles.heroSubtitle}>카메라와 LiDAR를 같은 시간축에서 탐색하는 3D 로그 뷰어</p>
        <p className={styles.heroDescription}>
          nuScenes 전처리, timestamp 동기화, GPU Buffer 재사용을 구현하고 로딩 비용을 측정했습니다.
          실제 센서 탐색과 가상 급제동 분석을 직접 확인할 수 있습니다.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/viewer" prefetch={false}>직접 탐색하기 <span aria-hidden="true">↗</span></Link>
          <a className={styles.secondaryLink} href="#demo"><span aria-hidden="true">▷</span> 1분 데모 보기</a>
        </div>
        <ul className={styles.techStack} aria-label="기술 스택">
          {['Next.js', 'TypeScript', 'Three.js', 'Python'].map(tech => <li key={tech}>{tech}</li>)}
        </ul>
      </div>
      <figure className={styles.preview}>
        <div className={styles.previewBar}><span><i className={styles.statusDot} /> 실제 센서 로그</span><span>scene-0061 / nuScenes mini</span></div>
        <a href="#demo" className={styles.previewImage} aria-label="실제 Viewer 화면과 1분 데모 영상 보기">
          <Image src={demoPoster} width={960} height={540}
            sizes="(max-width: 900px) 100vw, 50vw" preload
            alt="실제 LiDAR 점군, 전방 카메라, 차량 위치와 타임라인을 함께 표시하는 Viewer" />
          <span className={styles.previewPlay} aria-hidden="true">▷</span>
        </a>
        <figcaption><span>실제 실행 화면</span><span>LiDAR · CAM_FRONT · ego pose</span></figcaption>
      </figure>
      <dl className={styles.projectFacts}>
        <div><dt>실제 LiDAR / 탐색 Frame</dt><dd>34,752<span>points</span></dd></div>
        <div><dt>완료된 CPU Frame 캐시</dt><dd>5<span>frames max</span></dd></div>
        <div><dt>이미지 준비와 표시 분리</dt><dd>2<span>image slots</span></dd></div>
      </dl>
    </section>
  );
}
