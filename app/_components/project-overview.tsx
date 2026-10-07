import Image from "next/image";
import Link from "next/link";
import demoPoster from "../../public/demo/drivescope-demo-poster.jpg";
import styles from "../home.module.css";

export function ProjectOverview() {
  return (
    <section className={styles.hero} aria-labelledby="project-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>DriveScope · 3D 센서 로그 Viewer</p>
        <h1 id="project-title">카메라와 LiDAR,<br />하나의 시간축으로.</h1>
        <p className={styles.heroDescription}>
          서로 다른 시각에 기록된 사진과 점군을 함께 살펴봅니다.{" "}<br />
          실제 센서 데이터를 웹에서 재생하고 탐색할 수 있도록 만들었습니다.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/viewer" prefetch={false}>Viewer 열기 <span aria-hidden="true">↗</span></Link>
          <a className={styles.secondaryLink} href="#demo">1분 데모 보기</a>
        </div>
        <ul className={styles.techStack} aria-label="기술 스택">
          {['Next.js', 'TypeScript', 'Three.js', 'Python'].map(tech => <li key={tech}>{tech}</li>)}
        </ul>
      </div>
      <figure className={styles.preview}>
        <a href="#demo" className={styles.previewImage} aria-label="실제 Viewer 화면과 1분 데모 영상 보기">
          <Image src={demoPoster} width={960} height={540}
            sizes="(max-width: 1000px) 100vw, 960px" preload
            alt="실제 LiDAR 점군, 전방 카메라, 차량 위치와 타임라인을 함께 표시하는 Viewer" />
        </a>
        <figcaption>nuScenes mini · LiDAR, 전방 카메라, 차량 위치를 함께 표시한 실제 화면</figcaption>
      </figure>
    </section>
  );
}
