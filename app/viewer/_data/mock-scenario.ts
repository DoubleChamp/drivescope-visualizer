import type {
  CameraFrame,
  LidarFrame,
  ObjectDetection,
  ObjectDetectionFrame,
  ScenarioData,
  VehicleStateFrame,
} from "./frame-types";

const SCENARIO_DURATION_MS = 15_000;
const PEDESTRIAN_APPEARS_AT_MS = 10_000;
const PEDESTRIAN_DETECTED_AT_MS = 11_000;
const EMERGENCY_BRAKING_AT_MS = 12_400;
const VEHICLE_STOPPED_AT_MS = 13_400;
const CAMERA_INTERVAL_MS = 1_000;
const LIDAR_INTERVAL_MS = 500;
const PEDESTRIAN_ID = "pedestrian-1";

const createTimestamps = (intervalMs: number) =>
  Array.from(
    { length: SCENARIO_DURATION_MS / intervalMs + 1 },
    (_, index) => index * intervalMs,
  );

const getCameraImageUrl = (timestampMs: number) => {
  if (timestampMs < PEDESTRIAN_APPEARS_AT_MS) {
    return "/mock-camera/road-clear.svg";
  }

  if (timestampMs < EMERGENCY_BRAKING_AT_MS) {
    return "/mock-camera/pedestrian.svg";
  }

  return "/mock-camera/braking.svg";
};

const cameraFrames: CameraFrame[] = createTimestamps(CAMERA_INTERVAL_MS).map(
  (timestampMs) => ({
    timestampMs,
    imageUrl: getCameraImageUrl(timestampMs),
  }),
);

const ROAD_POINT_VALUES = [
  -2, 0, -40, 0, 0, -40, 2, 0, -40,
  -2, 0, -20, 0, 0, -20, 2, 0, -20,
  -2, 0, 0, 0, 0, 0, 2, 0, 0,
  -2, 0, 10, 0, 0, 10, 2, 0, 10,
  -2, 0, 20, 0, 0, 20, 2, 0, 20,
];

const PEDESTRIAN_POINT_VALUES = [
  -0.2, 0.2, 20, 0.2, 0.2, 20,
  -0.2, 0.9, 20, 0.2, 0.9, 20,
  -0.2, 1.6, 20, 0.2, 1.6, 20,
];

const createLidarPositions = (timestampMs: number) =>
  new Float32Array([
    ...ROAD_POINT_VALUES,
    ...(timestampMs >= PEDESTRIAN_APPEARS_AT_MS
      ? PEDESTRIAN_POINT_VALUES
      : []),
  ]);

const lidarFrames: LidarFrame[] = createTimestamps(LIDAR_INTERVAL_MS).map(
  (timestampMs) => ({
    timestampMs,
    positions: createLidarPositions(timestampMs),
  }),
);

const createPedestrianDetection = (
  timestampMs: number,
): ObjectDetection => ({
  id: PEDESTRIAN_ID,
  category: "pedestrian",
  confidence: timestampMs < 12_000 ? 0.9 : 0.96,
  center: [0, 0.9, 20],
  size: [0.6, 0.6, 1.8],
  yawRadians: 0,
});

const objectDetectionFrames: ObjectDetectionFrame[] = createTimestamps(
  CAMERA_INTERVAL_MS,
).map((timestampMs) => ({
  timestampMs,
  objects:
    timestampMs >= PEDESTRIAN_DETECTED_AT_MS
      ? [createPedestrianDetection(timestampMs)]
      : [],
}));

const createVehicleState = (timestampMs: number): VehicleStateFrame => {
  if (timestampMs < EMERGENCY_BRAKING_AT_MS) {
    return {
      timestampMs,
      position: [0, 0, -36 + (timestampMs / 1_000) * 4],
      yawRadians: 0,
      speedMetersPerSecond: 4,
      accelerationMetersPerSecondSquared: 0,
    };
  }

  if (timestampMs >= VEHICLE_STOPPED_AT_MS) {
    return {
      timestampMs,
      position: [0, 0, 15.6],
      yawRadians: 0,
      speedMetersPerSecond: 0,
      accelerationMetersPerSecondSquared: 0,
    };
  }

  const brakingElapsedSeconds =
    (timestampMs - EMERGENCY_BRAKING_AT_MS) / 1_000;

  return {
    timestampMs,
    position: [
      0,
      0,
      13.6 +
        4 * brakingElapsedSeconds -
        2 * brakingElapsedSeconds * brakingElapsedSeconds,
    ],
    yawRadians: 0,
    speedMetersPerSecond: 4 - 4 * brakingElapsedSeconds,
    accelerationMetersPerSecondSquared: -4,
  };
};

const vehicleStateTimestamps = [
  ...createTimestamps(1_000).filter((timestampMs) => timestampMs <= 12_000),
  EMERGENCY_BRAKING_AT_MS,
  13_000,
  VEHICLE_STOPPED_AT_MS,
  14_000,
  SCENARIO_DURATION_MS,
];

export const mockScenario: ScenarioData = {
  id: "pedestrian-emergency-braking",
  durationMs: SCENARIO_DURATION_MS,
  egoVehicleSize: [1.8, 4.5, 1.5],
  cameraFrames,
  lidarFrames,
  objectDetectionFrames,
  trajectoryFrames: [
    {
      timestampMs: 0,
      points: [
        { offsetMs: 0, position: [0, 0, -36] },
        { offsetMs: 1_000, position: [0, 0, -32] },
        { offsetMs: 2_000, position: [0, 0, -28] },
      ],
    },
    {
      timestampMs: 10_000,
      points: [
        { offsetMs: 0, position: [0, 0, 4] },
        { offsetMs: 1_000, position: [0, 0, 8] },
        { offsetMs: 2_000, position: [0, 0, 12] },
      ],
    },
    {
      timestampMs: 12_000,
      points: [
        { offsetMs: 0, position: [0, 0, 12] },
        { offsetMs: 1_000, position: [0, 0, 16] },
        { offsetMs: 2_000, position: [0, 0, 20] },
      ],
    },
    {
      timestampMs: EMERGENCY_BRAKING_AT_MS,
      points: [
        { offsetMs: 0, position: [0, 0, 13.6] },
        { offsetMs: 500, position: [0, 0, 15.1] },
        { offsetMs: 1_000, position: [0, 0, 15.6] },
        { offsetMs: 2_000, position: [0, 0, 15.6] },
      ],
    },
    {
      timestampMs: VEHICLE_STOPPED_AT_MS,
      points: [
        { offsetMs: 0, position: [0, 0, 15.6] },
        { offsetMs: 1_000, position: [0, 0, 15.6] },
        { offsetMs: 2_000, position: [0, 0, 15.6] },
      ],
    },
  ],
  vehicleStateFrames: vehicleStateTimestamps.map(createVehicleState),
  events: [
    {
      id: "emergency-braking-1",
      timestampMs: EMERGENCY_BRAKING_AT_MS,
      type: "emergency-braking",
    },
  ],
};
