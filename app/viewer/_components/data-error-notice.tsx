import styles from "../viewer-canvas.module.css";

type DataErrorNoticeProps = {
  title: string;
  message: string;
  error: Error;
  retryLabel: string;
  onRetry: () => void;
};

export function DataErrorNotice({
  title,
  message,
  error,
  retryLabel,
  onRetry,
}: DataErrorNoticeProps) {
  return (
    <div className={styles.dataErrorNotice}>
      <div role="alert">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <details className={styles.errorDetails}>
        <summary>오류 상세</summary>
        <p>{error.message}</p>
      </details>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}
