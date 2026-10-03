import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CameraFrame } from "../_data/frame-types";

type ImageSlot = 0 | 1;

export type BufferedCameraFrame = {
  frame: CameraFrame | null;
  activeSlot: ImageSlot | null;
  imageRefs: RefObject<[HTMLImageElement | null, HTMLImageElement | null]>;
  status: "empty" | "loading" | "ready" | "error";
  retry: () => void;
};

export function useBufferedCameraFrame(
  targetFrame: CameraFrame | null,
  sourceId: string,
): BufferedCameraFrame {
  const [requestAttempt, setRequestAttempt] = useState(0);
  const imageRefs = useRef<[HTMLImageElement | null, HTMLImageElement | null]>([
    null,
    null,
  ]);
  const activeSlotRef = useRef<ImageSlot>(1);
  const [displayed, setDisplayed] = useState<{
    sourceId: string;
    frame: CameraFrame;
    slot: ImageSlot;
  } | null>(null);
  const [failure, setFailure] = useState<{
    sourceId: string;
    imageUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!targetFrame) return;

    const nextSlot = activeSlotRef.current === 0 ? 1 : 0;
    const image = imageRefs.current[nextSlot];
    if (!image) return;

    let cancelled = false;
    // 화면에 보이지 않는 img만 변경한다. 다운로드와 디코딩 중에는 이전 사진을 유지한다.
    image.src = targetFrame.imageUrl;
    void image.decode().then(
      () => {
        if (cancelled) return;
        activeSlotRef.current = nextSlot;
        setDisplayed({ sourceId, frame: targetFrame, slot: nextSlot });
        setFailure(null);
      },
      () => {
        if (!cancelled) {
          setFailure({ sourceId, imageUrl: targetFrame.imageUrl });
        }
      },
    );

    // 빠른 seek와 unmount 뒤 오래된 decode 결과가 최신 화면을 덮어쓰지 못하게 한다.
    return () => {
      cancelled = true;
    };
  }, [sourceId, targetFrame, requestAttempt]);

  const currentDisplay =
    targetFrame && displayed?.sourceId === sourceId ? displayed : null;
  const hasError =
    failure?.sourceId === sourceId &&
    failure.imageUrl === targetFrame?.imageUrl;

  return {
    frame: currentDisplay?.frame ?? null,
    activeSlot: currentDisplay?.slot ?? null,
    imageRefs,
    status: !targetFrame
      ? "empty"
      : hasError
        ? "error"
        : currentDisplay?.frame.imageUrl === targetFrame.imageUrl &&
            currentDisplay.frame.timestampMs === targetFrame.timestampMs
          ? "ready"
          : "loading",
    retry: () => {
      setFailure(null);
      setRequestAttempt((attempt) => attempt + 1);
    },
  };
}
