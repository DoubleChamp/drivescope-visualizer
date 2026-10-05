import Image from "next/image";
import Link from "next/link";
import demoPoster from "../../public/demo/drivescope-demo-poster.jpg";
import styles from "../home.module.css";

export function ProjectOverview() {
  return (
    <section className={styles.hero} aria-labelledby="project-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>프로젝트 개요</p>
        <h1 id="project-title">DriveScope</h1>
        <p className={styles.heroSubtitle}>센서 로그를 같은 시간축에서 살펴보는 3D 뷰어</p>
        <p className={styles.heroDescription}>
          카메라 사진과 LiDAR 점군, 차량 위치를 함께 재생합니다.
          실제 센서 기록을 화면으로 옮기는 과정과 끊김을 줄이기 위해 적용한 설계를 소개합니다.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/viewer" prefetch={false}>Viewer 열기 <span aria-hidden="true">↗</span></Link>
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
        <figcaption><span>실제 실행 화면</span><span>LiDAR · 전방 카메라 · 차량 위치</span></figcaption>
      </figure>
      <dl className={styles.projectFacts}>
        <div><dt>기준선의 LiDAR 포인트 수</dt><dd>34,752<span>개</span></dd></div>
        <div><dt>다시 사용하는 센서 데이터</dt><dd>5<span>프레임까지</span></dd></div>
        <div><dt>사진을 준비하고 표시하는 공간</dt><dd>2<span>개</span></dd></div>
      </dl>
    </section>
  );
}
