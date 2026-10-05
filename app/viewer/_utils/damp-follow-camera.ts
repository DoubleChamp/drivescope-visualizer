import type { PerspectiveCamera, Vector3 } from "three";

// 재생 중 시점이 목표를 따라가는 시간 상수다. 센서 timestamp는 바꾸지 않는다.
const FOLLOW_CAMERA_RESPONSE_SECONDS = 0.12;

export function dampFollowCamera(
  camera: PerspectiveCamera,
  currentLookAt: Vector3,
  targetPosition: Vector3,
  targetLookAt: Vector3,
  deltaSeconds: number,
) {
  // 경과 시간으로 비율을 구해 60Hz·75Hz에서도 같은 속도로 따라가게 한다.
  const blend =
    1 - Math.exp(-Math.max(0, deltaSeconds) / FOLLOW_CAMERA_RESPONSE_SECONDS);
  camera.position.lerp(targetPosition, blend);
  currentLookAt.lerp(targetLookAt, blend);
  camera.lookAt(currentLookAt);
}
