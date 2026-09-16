import Link from "next/link";
import ViewerCanvas from "./viewer-canvas";

export default function ViewerPage() {
  return (
    <main>
      <h1>DriveScope Viewer</h1>
      <p>공통 시간축에 동기화된 가상 LiDAR Frame을 표시합니다.</p>
      <ViewerCanvas />
      <Link href="/">홈으로 돌아가기</Link>
    </main>
  );
}
