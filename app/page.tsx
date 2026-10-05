import type { Metadata } from "next";
import Link from "next/link";
import styles from "./landing.module.css";

const description =
  "카메라와 LiDAR를 하나의 시간축에서 살펴보는 DriveScope. 센서 로그 뷰어를 열거나 프로젝트의 구조와 성능 설계를 확인하세요.";

export const metadata: Metadata = {
  title: "DriveScope · 자율주행 로그 뷰어",
  description,
  openGraph: {
    title: "DriveScope · 자율주행 로그 뷰어",
    description,
    url: "https://drivescope-visualizer.vercel.app/",
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

export default function Home() {
  return (
    <main className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <p className={styles.eyebrow}>Autonomous driving · Scenario review</p>
        <h1 id="home-title">DriveScope</h1>
        <p className={styles.description}>
          카메라와 LiDAR를 하나의 시간축에 맞춰 살펴보고,
          가상 시나리오로 차량 판단과 반응을 추적합니다.
        </p>
        <div className={styles.signals} aria-label="분석 데이터">
          <span>Camera</span>
          <span>LiDAR</span>
          <span>Planning</span>
        </div>
        <nav className={styles.actions} aria-label="시작하기">
          <Link href="/viewer" className={styles.viewerLink} prefetch={false}>
            뷰어 열기 <span aria-hidden="true">→</span>
          </Link>
          <Link href="/project" className={styles.projectLink} prefetch={false}>
            프로젝트 개요 <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </section>
    </main>
  );
}
