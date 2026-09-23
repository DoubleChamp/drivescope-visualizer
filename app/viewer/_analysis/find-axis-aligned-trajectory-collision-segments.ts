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

// 두 값의 차이가 이보다 작으면 부동소수점 오차를 고려해 같은 값으로 본다.
const PARALLEL_EPSILON = 1e-9;

const clipSegmentToBounds = (
  start: Position,
  end: Position,
  bounds: AxisAlignedBounds,
): TrajectoryCollisionSegment | null => {
  // 선분을 P(t) = start + t(end - start), 0 <= t <= 1로 표현한다.
  // 아직 어느 축도 검사하지 않았으므로 처음에는 원본 선분 전체 [0, 1]이 후보 구간이다.
  let entryRatio = 0;
  let exitRatio = 1;

  // 한 축에서 선분이 [minimum, maximum] 안에 머무는 t 구간을 구하고,
  // 앞서 다른 축에서 구한 후보 구간과 교집합을 만든다.
  const clipAxis = (
    startValue: number,
    endValue: number,
    minimum: number,
    maximum: number,
  ) => {
    // 이 축의 좌표는 value(t) = startValue + t * difference로 변한다.
    const difference = endValue - startValue;

    // difference가 0이면 이 축의 좌표가 선분 전체에서 변하지 않는다.
    if (Math.abs(difference) < PARALLEL_EPSILON) {
      // 고정 좌표가 범위 안이면 이 축은 기존 [entryRatio, exitRatio]를 좁히지 않고,
      // 범위 밖이면 선분 전체가 이 축의 영역 밖이므로 충돌할 수 없다.
      return startValue >= minimum && startValue <= maximum;
    }

    // 경계에 도달하는 t를 구한다.
    // boundary = startValue + t * difference를 t에 대해 풀면
    // t = (boundary - startValue) / difference가 된다.
    const firstRatio = (minimum - startValue) / difference;
    const secondRatio = (maximum - startValue) / difference;

    // 역방향으로 움직이면 difference가 음수라 두 경계의 t 순서가 뒤집힌다.
    // 따라서 작은 t를 이 축의 진입 시점, 큰 t를 이 축의 이탈 시점으로 정한다.
    const axisEntryRatio = Math.min(firstRatio, secondRatio);
    const axisExitRatio = Math.max(firstRatio, secondRatio);

    // 모든 축을 동시에 만족해야 하므로 진입 시점 중 가장 늦은 값을 선택한다.
    entryRatio = Math.max(entryRatio, axisEntryRatio);

    // 이탈 시점 중 가장 이른 값을 선택하면 현재까지 남은 교집합의 끝이 된다.
    exitRatio = Math.min(exitRatio, axisExitRatio);

    // 진입 시점이 이탈 시점보다 늦으면 공통 t가 없어 이 축까지의 교집합이 비어 있다.
    return entryRatio <= exitRatio;
  };

  // 같은 t에서 X와 Z가 모두 사각형 안에 있어야 한다.
  // X 검사나 Z 검사 중 하나라도 교집합이 비면 이 선분에는 충돌 구간이 없다.
  if (
    !clipAxis(start[0], end[0], bounds.minX, bounds.maxX) ||
    !clipAxis(start[2], end[2], bounds.minZ, bounds.maxZ)
  ) {
    return null;
  }

  // 최종 t를 원래 3D 선분에 대입해 잘린 구간의 실제 XYZ 좌표를 복원한다.
  const interpolatePosition = (ratio: number): Position => [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
    start[2] + (end[2] - start[2]) * ratio,
  ];

  // entryRatio와 exitRatio 사이만 확장된 충돌 사각형 안에 있는 빨간 선분이다.
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

  // 경로점 [0, 1, 2, ...]를 [0→1], [1→2], ...의 독립된 선분으로 검사한다.
  for (let index = 0; index < points.length - 1; index += 1) {
    const collisionSegment = clipSegmentToBounds(
      points[index].position,
      points[index + 1].position,
      collisionBounds,
    );

    // null이 아니라면 원본 선분 중 실제로 경계 안에 포함된 일부만 저장한다.
    if (collisionSegment) {
      collisionSegments.push(collisionSegment);
    }
  }

  return collisionSegments;
};
