import Link from "next/link";
import ViewerCanvas from "./viewer-canvas";

export default function ViewerPage() {
  return (
    <main>
      <h1>DriveScope Viewer</h1>
      <p>공간 기준 Grid 위에 가상 포인트 10,000개를 표시합니다.</p>
      <ViewerCanvas />
      <Link href="/">홈으로 돌아가기</Link>
    </main>
  );
}
