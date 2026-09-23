import type { ScenarioEvent } from "../_data/frame-types";
import { PLAYBACK_STEP_MS } from "../_hooks/use-playback";
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

export function PlaybackControls({
  currentTimeMs,
  durationMs,
  events,
  isPlaying,
  onSeek,
  onTogglePlayback,
}: PlaybackControlsProps) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.playbackButton}
        aria-pressed={isPlaying}
        onClick={onTogglePlayback}
      >
        {isPlaying ? "정지" : "재생"}
      </button>
      <div className={styles.timelineControl}>
        <label htmlFor="viewer-timeline" className={styles.timelineLabel}>
          타임라인
        </label>
        <div className={styles.timelineTrack}>
          <input
            id="viewer-timeline"
            type="range"
            className={styles.timeline}
            min={0}
            max={durationMs}
            step={PLAYBACK_STEP_MS}
            value={currentTimeMs}
            aria-valuetext={`${(currentTimeMs / 1_000).toFixed(1)}초`}
            onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
          />
          <div className={styles.timelineEvents}>
            {events.map((event) => {
              const eventLabel = EVENT_TYPE_LABELS[event.type];
              const eventTimeSeconds = (event.timestampMs / 1_000).toFixed(1);
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
