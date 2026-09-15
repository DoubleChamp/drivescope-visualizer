export type LidarFrame = {
  timestampMs: number;
  positions: Float32Array;
};

export type CameraFrame = {
  timestampMs: number;
  imageUrl: string;
};

export type ObjectDetection = {
  id: string;
  category: "vehicle" | "pedestrian";
  confidence: number;
  center: [x: number, y: number, z: number];
  size: [width: number, length: number, height: number];
  yawRadians: number;
};

export type ObjectDetectionFrame = {
  timestampMs: number;
  objects: ObjectDetection[];
};
