import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DriveScope · 자율주행 시나리오 분석",
  description:
    "카메라, LiDAR와 차량 판단을 하나의 시간축에서 분석하는 시각화 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
