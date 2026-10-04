import Image from "next/image";
import Link from "next/link";
import styles from "../home.module.css";

export function ProjectOverview() {
  return (
    <section className={styles.hero} aria-labelledby="project-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.statusDot} /> DATA PIPELINE · PERFORMANCE</p>
        <h1 id="project-title">센서 로그를 연결하고,<br /><span>처리 비용을 추적하다.</span></h1>
        <p className={styles.heroDescription}>
          DriveScope는 카메라·LiDAR·차량 위치를 하나의 시간축에서 탐색하는 웹 뷰어입니다.
          실제 데이터 전처리부터 WebGL 표시까지, 데이터 계약과 재사용 구조를 설계하고 성능을 측정했습니다.
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
          <Image src="/demo/drivescope-demo-poster.jpg" width={960} height={540}
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
