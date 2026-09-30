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
}: PlaybackControlsProps) {
  const progressPercent = (currentTimeMs / durationMs) * 100;

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.playbackButton}
        aria-pressed={isPlaying}
        onClick={onTogglePlayback}
      >
        <span className={styles.playbackIcon} aria-hidden="true">
          {isPlaying ? "Ⅱ" : "▶"}
        </span>
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
            <strong>{formatPlaybackTime(currentTimeMs)}</strong>
            <span>/ {formatPlaybackTime(durationMs)}</span>
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
            step={PLAYBACK_STEP_MS}
            value={currentTimeMs}
            aria-valuetext={`${formatSeconds(currentTimeMs)}초`}
            onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
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
