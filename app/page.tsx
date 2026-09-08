import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>DriveScope</h1>
      <p>자율주행 문제 장면을 하나의 타임라인에서 분석합니다.</p>
      <Link href="/viewer">Viewer 열기</Link>
    </main>
  );
}
