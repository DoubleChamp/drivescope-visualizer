import { useEffect, useRef, useState } from "react";

export const PLAYBACK_STEP_MS = 100;
const INITIAL_TIME_MS = 0;

export function usePlayback(durationMs: number) {
  const playbackStartedAtRef = useRef(0);
  const playbackTimeAtStartRef = useRef(INITIAL_TIME_MS);
  const [currentTimeMs, setCurrentTimeMs] = useState(INITIAL_TIME_MS);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    // 고정 간격을 더하지 않고 실제 경과 시간을 사용해 interval 지연이 누적되지 않게 한다.
    const intervalId = window.setInterval(() => {
      const elapsedMs = performance.now() - playbackStartedAtRef.current;
      const nextTimeMs = Math.min(
        Math.round(playbackTimeAtStartRef.current + elapsedMs),
        durationMs,
      );

      setCurrentTimeMs(nextTimeMs);
      if (nextTimeMs >= durationMs) setIsPlaying(false);
    }, PLAYBACK_STEP_MS);

    return () => window.clearInterval(intervalId);
  }, [durationMs, isPlaying]);

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const nextStartTimeMs =
      currentTimeMs >= durationMs ? INITIAL_TIME_MS : currentTimeMs;

    setCurrentTimeMs(nextStartTimeMs);
    playbackTimeAtStartRef.current = nextStartTimeMs;
    playbackStartedAtRef.current = performance.now();
    setIsPlaying(true);
  };

  const seek = (nextTimeMs: number) => {
    setIsPlaying(false);
    setCurrentTimeMs(nextTimeMs);
  };

  return { currentTimeMs, isPlaying, seek, togglePlayback };
}
