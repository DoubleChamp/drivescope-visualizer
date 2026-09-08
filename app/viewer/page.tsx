import Link from "next/link";
import ViewerCanvas from "./viewer-canvas";

export default function ViewerPage() {
  return (
    <main>
      <h1>DriveScope Viewer</h1>
      <p>Three.js로 공간 기준 Grid를 표시하는 Canvas입니다.</p>
      <ViewerCanvas />
      <Link href="/">홈으로 돌아가기</Link>
    </main>
  );
}
