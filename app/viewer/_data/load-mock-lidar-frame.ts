import type { LidarFrame } from "./frame-types";

export async function loadMockLidarFrame(
  sourceFrames: readonly LidarFrame[],
  timestampMs: number,
) {
  const sourceFrame = sourceFrames.find(
    (frame) => frame.timestampMs === timestampMs,
  );
  if (!sourceFrame) return null;

  // 실제 파일의 바이트를 파싱해 새 좌표 배열을 만드는 로더 경계를 가상 데이터로 표현한다.
  await Promise.resolve();
  return {
    timestampMs: sourceFrame.timestampMs,
    positions: new Float32Array(sourceFrame.positions),
  } satisfies LidarFrame;
}
