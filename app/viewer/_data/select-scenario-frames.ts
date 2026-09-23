import { findLatestFrameAtOrBefore } from "./find-latest-frame-at-or-before";
import type { ScenarioData } from "./frame-types";

export const selectScenarioFrames = (
  scenario: ScenarioData,
  currentTimeMs: number,
) => ({
  camera: findLatestFrameAtOrBefore(scenario.cameraFrames, currentTimeMs),
  lidar: findLatestFrameAtOrBefore(scenario.lidarFrames, currentTimeMs),
  objectDetection: findLatestFrameAtOrBefore(
    scenario.objectDetectionFrames,
    currentTimeMs,
  ),
  vehicleState: findLatestFrameAtOrBefore(
    scenario.vehicleStateFrames,
    currentTimeMs,
  ),
  trajectory: findLatestFrameAtOrBefore(
    scenario.trajectoryFrames,
    currentTimeMs,
  ),
});
