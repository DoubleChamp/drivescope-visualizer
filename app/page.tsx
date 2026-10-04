import type { Metadata } from "next";
import Link from "next/link";
import { ProjectOverview } from "./_components/project-overview";
import { ProjectArchitecture } from "./_components/project-architecture";
import { ProjectOptimizations } from "./_components/project-optimizations";
import { ProjectResults } from "./_components/project-results";
import { ProjectDemo } from "./_components/project-demo";
import styles from "./home.module.css";

const description =
  "nuScenes 센서 로그의 전처리부터 WebGL 표시까지. DriveScope의 데이터 계약, Frame 캐시, GPU Buffer 재사용과 성능 측정을 소개합니다.";

export const metadata: Metadata = {
  title: "DriveScope · 데이터 처리와 성능 설계",
  description,
  openGraph: {
    title: "DriveScope · 데이터 처리와 성능 설계",
    description,
    url: "https://drivescope-visualizer.vercel.app/",
    locale: "ko_KR",
    type: "website",
    images: [{
      url: "https://drivescope-visualizer.vercel.app/demo/drivescope-demo-poster.jpg",
      width: 960,
      height: 540,
      alt: "DriveScope에서 실제 nuScenes 점군과 카메라를 탐색하는 화면",
    }],
  },
};

export default function Home() {
  return (
    <div className={styles.home}>
      <a className={styles.skipLink} href="#project">본문으로 건너뛰기</a>
      <header className={styles.header}>
        <a className={styles.brand} href="#project" aria-label="DriveScope 소개로 이동">
          <span className={styles.brandMark} aria-hidden="true">+</span>
          DriveScope<span className={styles.brandNote}>Engineering case study</span>
        </a>
        <nav className={styles.nav} aria-label="프로젝트 소개">
          <a href="#architecture">구조</a>
          <a href="#optimizations">최적화</a>
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
            <p className={styles.eyebrow}>NEXT QUESTIONS</p>
            <h2 id="next-title">다음 개선도, 측정에서 시작합니다.</h2>
            <p>파일 읽기·파싱 시간을 분리하고 P95와 메인 스레드 정지를 측정한 뒤,
              Worker·transferable Buffer의 효과를 비교할 계획입니다.</p>
          </div>
          <a className={styles.textLink} href="https://github.com/DoubleChamp/drivescope-visualizer/blob/main/docs/ROADMAP.md">
            개선 계획 읽기 <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>DriveScope <span>데이터 흐름을 설계하고, 결과를 검증하는 프로젝트.</span></p>
        <a href="https://github.com/DoubleChamp/drivescope-visualizer">GitHub <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
