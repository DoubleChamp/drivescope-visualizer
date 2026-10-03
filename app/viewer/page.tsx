import Link from "next/link";
import ViewerCanvas from "./viewer-canvas";
import styles from "./viewer-canvas.module.css";

export default function ViewerPage() {
  return (
    <main className={styles.page}>
      <header className={styles.appHeader}>
        <div className={styles.appHeaderInner}>
          <Link href="/" className={styles.brand} aria-label="DriveScope 홈">
            <span className={styles.brandMark} aria-hidden="true">
              <span className={styles.brandMarkCore} />
            </span>
            <span className={styles.brandCopy}>
              <strong>DriveScope</strong>
              <span>Scenario intelligence</span>
            </span>
          </Link>

          <div className={styles.appHeaderStatus}>
            <span className={styles.environmentBadge}>센서 로그 분석</span>
          </div>
        </div>
      </header>

      <div className={styles.pageContent}>
        <ViewerCanvas />
      </div>
    </main>
  );
}
