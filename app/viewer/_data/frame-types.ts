export type LidarFrame = {
  timestampMs: number;
  positions: Float32Array;
};

export type CameraFrame = {
  timestampMs: number;
  imageUrl: string;
};
