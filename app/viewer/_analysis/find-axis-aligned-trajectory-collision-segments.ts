import type {
  BoxSize,
  ObjectDetection,
  TrajectoryPoint,
} from "../_data/frame-types";

type Position = TrajectoryPoint["position"];

export type TrajectoryCollisionSegment = {
  start: Position;
  end: Position;
};

type AxisAlignedBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const PARALLEL_EPSILON = 1e-9;

const clipSegmentToBounds = (
  start: Position,
  end: Position,
  bounds: AxisAlignedBounds,
): TrajectoryCollisionSegment | null => {
  let entryRatio = 0;
  let exitRatio = 1;

  const clipAxis = (
    startValue: number,
    endValue: number,
    minimum: number,
    maximum: number,
  ) => {
    const difference = endValue - startValue;

    if (Math.abs(difference) < PARALLEL_EPSILON) {
      return startValue >= minimum && startValue <= maximum;
    }

    const firstRatio = (minimum - startValue) / difference;
    const secondRatio = (maximum - startValue) / difference;
    const axisEntryRatio = Math.min(firstRatio, secondRatio);
    const axisExitRatio = Math.max(firstRatio, secondRatio);

    entryRatio = Math.max(entryRatio, axisEntryRatio);
    exitRatio = Math.min(exitRatio, axisExitRatio);

    return entryRatio <= exitRatio;
  };

  if (
    !clipAxis(start[0], end[0], bounds.minX, bounds.maxX) ||
    !clipAxis(start[2], end[2], bounds.minZ, bounds.maxZ)
  ) {
    return null;
  }

  const interpolatePosition = (ratio: number): Position => [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
    start[2] + (end[2] - start[2]) * ratio,
  ];

  return {
    start: interpolatePosition(entryRatio),
    end: interpolatePosition(exitRatio),
  };
};

// 현재 가상 시나리오는 차량과 보행자의 yaw가 0인 직선 주행이다.
// 차량 중심 경로와 확장된 보행자 footprint를 비교해 두 박스의 겹침을 판정한다.
export const findAxisAlignedTrajectoryCollisionSegments = (
  points: readonly TrajectoryPoint[],
  pedestrian: ObjectDetection,
  egoVehicleSize: BoxSize,
): TrajectoryCollisionSegment[] => {
  const [pedestrianX, , pedestrianZ] = pedestrian.center;
  const [pedestrianWidth, pedestrianLength] = pedestrian.size;
  const [vehicleWidth, vehicleLength] = egoVehicleSize;
  const collisionHalfWidth = (pedestrianWidth + vehicleWidth) / 2;
  const collisionHalfLength = (pedestrianLength + vehicleLength) / 2;
  const collisionBounds: AxisAlignedBounds = {
    minX: pedestrianX - collisionHalfWidth,
    maxX: pedestrianX + collisionHalfWidth,
    minZ: pedestrianZ - collisionHalfLength,
    maxZ: pedestrianZ + collisionHalfLength,
  };
  const collisionSegments: TrajectoryCollisionSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const collisionSegment = clipSegmentToBounds(
      points[index].position,
      points[index + 1].position,
      collisionBounds,
    );

    if (collisionSegment) {
      collisionSegments.push(collisionSegment);
    }
  }

  return collisionSegments;
};
