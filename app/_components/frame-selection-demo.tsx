"use client";

import { useState } from "react";
import { findLatestFrameAtOrBefore } from "../viewer/_data/find-latest-frame-at-or-before";
import styles from "../home.module.css";

// Small camera-only example, using the same selection rule as the Viewer.
// No sensor files, Three.js runtime or animation loop is needed on the home page.
const frames = [10000, 11000, 12000, 13000, 14000].map(timestampMs => ({ timestampMs }));

export function FrameSelectionDemo() {
  const [timeMs, setTimeMs] = useState(12400);
  const frame = findLatestFrameAtOrBefore(frames, timeMs)!;
  const deltaMs = frame.timestampMs - timeMs;
  const nextFrame = frames.find(item => item.timestampMs > timeMs);

  return (
    <div className={styles.frameDemo}>
      <div className={styles.demoHeading}><span className={styles.eyebrow}>Frame 선택 예시</span><span>가상 Camera · 1초 주기</span></div>
      <div className={styles.frameReadout}>
        <div><span>재생 시각</span><strong><output htmlFor="frame-time">{(timeMs / 1000).toFixed(1)}</output><small>초</small></strong></div>
        <span className={styles.frameArrow} aria-hidden="true">→</span>
        <div><span>표시할 Frame</span><strong data-selected-time>{(frame.timestampMs / 1000).toFixed(1)}<small>초</small></strong></div>
        <span className={styles.delta} data-frame-delta>{deltaMs}ms</span>
      </div>
      <label className={styles.rangeLabel} htmlFor="frame-time">타임라인을 움직여 Frame 선택을 확인하세요.</label>
      <input id="frame-time" className={styles.frameRange} type="range" min={10000} max={14000} step={100}
        value={timeMs} onChange={event => setTimeMs(Number(event.target.value))}
        aria-valuetext={`재생 ${(timeMs / 1000).toFixed(1)}초, 표시 Frame ${(frame.timestampMs / 1000).toFixed(1)}초, 차이 ${deltaMs}밀리초`} />
      <ol className={styles.frameTicks} aria-label="카메라 수집 Frame">
        {frames.map(item => (
          <li key={item.timestampMs} data-selected={item.timestampMs === frame.timestampMs} data-future={item.timestampMs > timeMs}>
            <span>{(item.timestampMs / 1000).toFixed(1)}초</span>
            <small>{item.timestampMs === frame.timestampMs ? "표시" : item.timestampMs > timeMs ? "미래" : "과거"}</small>
          </li>
        ))}
      </ol>
      <p className={styles.demoNote}>
        {(timeMs / 1000).toFixed(1)}초에는 {(frame.timestampMs / 1000).toFixed(1)}초 사진을 선택합니다.{" "}
        {nextFrame
          ? `아직 도달하지 않은 ${(nextFrame.timestampMs / 1000).toFixed(1)}초 사진을 미리 표시하지 않습니다.`
          : "준비된 마지막 Frame을 표시하고 있습니다."}
      </p>
    </div>
  );
}
