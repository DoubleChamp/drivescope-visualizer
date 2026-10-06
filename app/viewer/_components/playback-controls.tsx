import type { CSSProperties } from "react";
import type { ScenarioEvent } from "../_data/frame-types";
import { PLAYBACK_STEP_MS } from "../_hooks/use-playback";
import { formatSeconds } from "../_utils/format-time";
import styles from "../viewer-canvas.module.css";

type PlaybackControlsProps = {
  currentTimeMs: number;
  durationMs: number;
  events: readonly ScenarioEvent[];
  isPlaying: boolean;
  onSeek: (timeMs: number) => void;
  onTogglePlayback: () => void;
  disabled?: boolean;
  stepMs?: number;
};

const EVENT_TYPE_LABELS: Record<ScenarioEvent["type"], string> = {
  "emergency-braking": "급제동",
};

const formatPlaybackTime = (timeMs: number) => {
  const minutes = Math.floor(timeMs / 60_000);
  const seconds = formatSeconds(timeMs % 60_000).padStart(4, "0");

  return `${minutes.toString().padStart(2, "0")}:${seconds}`;
};

export function PlaybackControls({
  currentTimeMs,
  durationMs,
  events,
  isPlaying,
  onSeek,
  onTogglePlayback,
  disabled = false,
  stepMs = PLAYBACK_STEP_MS,
}: PlaybackControlsProps) {
  const progressPercent = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;
  const isDisabled = disabled || durationMs <= 0;

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.playbackButton}
        aria-pressed={isPlaying}
        disabled={isDisabled}
        onClick={onTogglePlayback}
      >
        <svg
          className={styles.playbackIcon}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          {isPlaying ? (
            <>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </>
          ) : (
            <path d="M8 4.5v15l12-7.5z" />
          )}
        </svg>
        {isPlaying ? "정지" : "재생"}
      </button>
      <div className={styles.timelineControl}>
        <div className={styles.timelineMeta}>
          <label htmlFor="viewer-timeline" className={styles.timelineLabel}>
            Timeline
          </label>
          <output
            htmlFor="viewer-timeline"
            className={styles.timelineTime}
            aria-live="off"
          >
            <strong>{disabled ? "준비 중" : formatPlaybackTime(currentTimeMs)}</strong>
            <span>{disabled ? "센서 로그 연결 중" : `/ ${formatPlaybackTime(durationMs)}`}</span>
          </output>
        </div>
        <div
          className={styles.timelineTrack}
          style={
            {
              "--timeline-progress": `${progressPercent}%`,
            } as CSSProperties
          }
        >
          <input
            id="viewer-timeline"
            type="range"
            className={styles.timeline}
            min={0}
            max={durationMs}
            step={stepMs}
            value={currentTimeMs}
            disabled={isDisabled}
            aria-valuetext={`${formatSeconds(currentTimeMs)}초`}
            onChange={(event) => {
              const timeMs = event.currentTarget.valueAsNumber;
              // 마지막 센서 시각이 step 배수가 아니어도 타임라인 끝에서 마지막 Frame을 고른다.
              const lastStepMs = Math.floor(durationMs / stepMs) * stepMs;
              onSeek(timeMs > 0 && timeMs === lastStepMs ? durationMs : timeMs);
            }}
          />
          <div className={styles.timelineEvents}>
            {events.map((event) => {
              const eventLabel = EVENT_TYPE_LABELS[event.type];
              const eventTimeSeconds = formatSeconds(event.timestampMs);
              const positionPercent = (event.timestampMs / durationMs) * 100;
              const accessibleLabel = `${eventLabel} ${eventTimeSeconds}초`;

              return (
                <span
                  key={event.id}
                  role="img"
                  className={styles.timelineEvent}
                  style={{ left: `${positionPercent}%` }}
                  aria-label={accessibleLabel}
                  title={accessibleLabel}
                >
                  <span aria-hidden="true">{accessibleLabel}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
