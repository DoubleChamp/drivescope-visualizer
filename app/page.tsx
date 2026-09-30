import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Autonomous driving · Scenario review</p>
        <h1>DriveScope</h1>
        <p className={styles.description}>
          카메라, LiDAR와 차량 판단을 하나의 시간축에 맞춰 문제 장면의
          원인과 반응을 추적합니다.
        </p>
        <div className={styles.signals} aria-label="분석 데이터">
          <span>Camera</span>
          <span>LiDAR</span>
          <span>Planning</span>
        </div>
        <Link href="/viewer" className={styles.viewerLink}>
          분석 Viewer 열기
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
