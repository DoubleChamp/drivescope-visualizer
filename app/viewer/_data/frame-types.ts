export type LidarFrame = {
  timestampMs: number;
  positions: Float32Array;
};

export type CameraFrame = {
  timestampMs: number;
  imageUrl: string;
};

export type BoxSize = [width: number, length: number, height: number];

export type ObjectDetection = {
  id: string;
  category: "vehicle" | "pedestrian";
  confidence: number;
  center: [x: number, y: number, z: number];
  size: BoxSize;
  yawRadians: number;
};

export type ObjectDetectionFrame = {
  timestampMs: number;
  objects: ObjectDetection[];
};

export type TrajectoryPoint = {
  offsetMs: number;
  position: [x: number, y: number, z: number];
};

export type TrajectoryFrame = {
  timestampMs: number;
  points: TrajectoryPoint[];
};

export type VehicleStateFrame = {
  timestampMs: number;
  position: [x: number, y: number, z: number];
  yawRadians: number;
  speedMetersPerSecond: number;
  accelerationMetersPerSecondSquared: number;
};

export type ScenarioEvent = {
  id: string;
  timestampMs: number;
  type: "emergency-braking";
};

export type ScenarioData = {
  id: string;
  durationMs: number;
  egoVehicleSize: BoxSize;
  lidarFrames: LidarFrame[];
  cameraFrames: CameraFrame[];
  objectDetectionFrames: ObjectDetectionFrame[];
  trajectoryFrames: TrajectoryFrame[];
  vehicleStateFrames: VehicleStateFrame[];
  events: ScenarioEvent[];
};
