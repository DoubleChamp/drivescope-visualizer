import type { Metadata } from "next";
import Link from "next/link";
import { ProjectOverview } from "../_components/project-overview";
import { ProjectArchitecture } from "../_components/project-architecture";
import { ProjectOptimizations } from "../_components/project-optimizations";
import { ProjectResults } from "../_components/project-results";
import { ProjectDemo } from "../_components/project-demo";
import styles from "../home.module.css";

const description =
  "카메라와 LiDAR 기록을 화면에 옮기는 과정, 안정적인 재생을 위한 설계와 실제 측정 결과를 소개합니다.";

export const metadata: Metadata = {
  title: "DriveScope · 데이터 처리와 성능 설계",
  description,
  openGraph: {
    title: "DriveScope · 데이터 처리와 성능 설계",
    description,
    url: "https://drivescope-visualizer.vercel.app/project",
    locale: "ko_KR",
    type: "website",
    images: [{
      url: "https://drivescope-visualizer.vercel.app/demo/drivescope-demo-poster.jpg?v=2",
      width: 960,
      height: 540,
      alt: "DriveScope에서 실제 nuScenes 점군과 카메라를 탐색하는 화면",
    }],
  },
};

export default function ProjectPage() {
  return (
    <div className={styles.home}>
      <a className={styles.skipLink} href="#project">본문으로 건너뛰기</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" prefetch={false} aria-label="DriveScope 홈으로 이동">
          <span className={styles.brandMark} aria-hidden="true">+</span>
          DriveScope<span className={styles.brandNote}>홈으로</span>
        </Link>
        <nav className={styles.nav} aria-label="프로젝트 소개">
          <a href="#architecture">구조</a>
          <a href="#optimizations">문제 해결</a>
          <a href="#results">측정</a>
          <a href="#demo">1분 영상</a>
        </nav>
        <Link className={styles.headerLink} href="/viewer" prefetch={false}>
          Viewer 열기 <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="project" className={styles.content}>
        <ProjectOverview />
        <ProjectArchitecture />
        <ProjectOptimizations />
        <ProjectResults />
        <ProjectDemo />
        <section className={styles.nextSection} aria-labelledby="next-title">
          <div>
            <p className={styles.eyebrow}>개선 기록</p>
            <h2 id="next-title">측정에서 다음 개선까지</h2>
            <p>데이터 로딩 시간과 화면의 반응을 측정하고,
              파싱 방식과 프레임 선택, 센서 원본 주기 재생을 비교했습니다.</p>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>DriveScope <span>데이터 흐름을 설계하고, 결과를 검증하는 프로젝트.</span></p>
      </footer>
    </div>
  );
}
