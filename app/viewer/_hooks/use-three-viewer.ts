import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  GridHelper,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { findAxisAlignedTrajectoryCollisionSegments } from "../_analysis/find-axis-aligned-trajectory-collision-segments";
import type {
  LidarFrame,
  ObjectDetection,
  ScenarioData,
  TrajectoryFrame,
  VehicleStateFrame,
} from "../_data/frame-types";

const FPS_SAMPLE_INTERVAL_MS = 1_000;
const TRAJECTORY_RENDER_HEIGHT = 0.05;
const COLLISION_RENDER_HEIGHT = TRAJECTORY_RENDER_HEIGHT + 0.02;
const PEDESTRIAN_DEFAULT_COLOR = 0xf97316;
const PEDESTRIAN_SELECTED_COLOR = 0xe879f9;

type UseThreeViewerOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  scenario: ScenarioData;
  lidarFrame: LidarFrame | null;
  pedestrian: ObjectDetection | null;
  vehicleStateFrame: VehicleStateFrame | null;
  trajectoryFrame: TrajectoryFrame | null;
  selectedObjectId: string | null;
  setSelectedObjectId: Dispatch<SetStateAction<string | null>>;
};

export function useThreeViewer({
  canvasRef,
  scenario,
  lidarFrame,
  pedestrian,
  vehicleStateFrame,
  trajectoryFrame,
  selectedObjectId,
  setSelectedObjectId,
}: UseThreeViewerOptions) {
  const lidarGeometryRef = useRef<BufferGeometry | null>(null);
  const lidarPositionAttributeRef = useRef<BufferAttribute | null>(null);
  const pedestrianBoxRef = useRef<Mesh | null>(null);
  const pedestrianMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const vehicleBoxRef = useRef<Mesh | null>(null);
  const trajectoryGeometryRef = useRef<BufferGeometry | null>(null);
  const trajectoryPositionAttributeRef = useRef<BufferAttribute | null>(null);
  const collisionGeometryRef = useRef<BufferGeometry | null>(null);
  const collisionPositionAttributeRef = useRef<BufferAttribute | null>(null);
  const [framesPerSecond, setFramesPerSecond] = useState<number | null>(null);

  // Canvas가 존재하는 동안 Three.js 리소스와 DOM listener의 전체 생명주기를 소유한다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const lidarBufferLength = Math.max(
      0,
      ...scenario.lidarFrames.map((frame) => frame.positions.length),
    );
    const trajectoryBufferLength = Math.max(
      0,
      ...scenario.trajectoryFrames.map((frame) => frame.points.length * 3),
    );
    const collisionBufferLength = Math.max(
      0,
      ...scenario.trajectoryFrames.map(
        (frame) => Math.max(0, frame.points.length - 1) * 2 * 3,
      ),
    );
    const scene = new Scene();
    const grid = new GridHelper(80, 16);
    const camera = new PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1_000,
    );

    scene.add(grid);

    // 런타임 리소스는 한 번 만들고 아래 Frame effect들이 Buffer와 transform만 갱신한다.
    const lidarPositionAttribute = new BufferAttribute(
      new Float32Array(lidarBufferLength),
      3,
    );
    lidarPositionAttribute.setUsage(DynamicDrawUsage);
    const lidarGeometry = new BufferGeometry();
    lidarGeometry.setAttribute("position", lidarPositionAttribute);
    lidarGeometry.setDrawRange(0, 0);
    const lidarMaterial = new PointsMaterial({ color: 0x38bdf8, size: 0.18 });
    scene.add(new Points(lidarGeometry, lidarMaterial));
    lidarGeometryRef.current = lidarGeometry;
    lidarPositionAttributeRef.current = lidarPositionAttribute;

    const boxGeometry = new BoxGeometry(1, 1, 1);
    const pedestrianMaterial = new MeshBasicMaterial({
      color: PEDESTRIAN_DEFAULT_COLOR,
      wireframe: true,
    });
    const pedestrianBox = new Mesh(boxGeometry, pedestrianMaterial);
    pedestrianBox.visible = false;
    scene.add(pedestrianBox);
    pedestrianBoxRef.current = pedestrianBox;
    pedestrianMaterialRef.current = pedestrianMaterial;

    const vehicleMaterial = new MeshBasicMaterial({
      color: 0x22c55e,
      wireframe: true,
    });
    const vehicleBox = new Mesh(boxGeometry, vehicleMaterial);
    vehicleBox.visible = false;
    scene.add(vehicleBox);
    vehicleBoxRef.current = vehicleBox;

    const trajectoryPositionAttribute = new BufferAttribute(
      new Float32Array(trajectoryBufferLength),
      3,
    );
    trajectoryPositionAttribute.setUsage(DynamicDrawUsage);
    const trajectoryGeometry = new BufferGeometry();
    trajectoryGeometry.setAttribute("position", trajectoryPositionAttribute);
    trajectoryGeometry.setDrawRange(0, 0);
    const trajectoryMaterial = new LineBasicMaterial({ color: 0xfacc15 });
    scene.add(new Line(trajectoryGeometry, trajectoryMaterial));
    trajectoryGeometryRef.current = trajectoryGeometry;
    trajectoryPositionAttributeRef.current = trajectoryPositionAttribute;

    const collisionPositionAttribute = new BufferAttribute(
      new Float32Array(collisionBufferLength),
      3,
    );
    collisionPositionAttribute.setUsage(DynamicDrawUsage);
    const collisionGeometry = new BufferGeometry();
    collisionGeometry.setAttribute("position", collisionPositionAttribute);
    collisionGeometry.setDrawRange(0, 0);
    const collisionMaterial = new LineBasicMaterial({ color: 0xef4444 });
    scene.add(new LineSegments(collisionGeometry, collisionMaterial));
    collisionGeometryRef.current = collisionGeometry;
    collisionPositionAttributeRef.current = collisionPositionAttribute;

    camera.position.set(30, 25, -30);
    camera.lookAt(0, 0, -10);

    const renderer = new WebGLRenderer({ canvas });
    const raycaster = new Raycaster();
    const pointerPosition = new Vector2();
    const handleResize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const handleCanvasClick = (event: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0 || !pedestrianBox.visible) {
        setSelectedObjectId(null);
        return;
      }

      // DOM의 아래 방향 Y를 WebGL의 위 방향 Y로 뒤집어 NDC [-1, 1]로 변환한다.
      pointerPosition.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      camera.updateMatrixWorld();
      pedestrianBox.updateWorldMatrix(true, false);
      raycaster.setFromCamera(pointerPosition, camera);

      const objectId = pedestrianBox.userData.objectId;
      const hit = raycaster.intersectObject(pedestrianBox, false).length > 0;
      setSelectedObjectId(hit && typeof objectId === "string" ? objectId : null);
    };
    let animationFrameId: number;
    let sampleStartedAt: number | null = null;
    let renderedFrameCount = 0;
    const renderFrame = (timestamp: number) => {
      renderer.render(scene, camera);

      if (sampleStartedAt === null) {
        sampleStartedAt = timestamp;
      } else {
        renderedFrameCount += 1;
        const elapsedMs = timestamp - sampleStartedAt;
        if (elapsedMs >= FPS_SAMPLE_INTERVAL_MS) {
          setFramesPerSecond(
            Math.round((renderedFrameCount * 1_000) / elapsedMs),
          );
          renderedFrameCount = 0;
          sampleStartedAt = timestamp;
        }
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    canvas.addEventListener("click", handleCanvasClick);
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("click", handleCanvasClick);
      lidarGeometryRef.current = null;
      lidarPositionAttributeRef.current = null;
      pedestrianBoxRef.current = null;
      pedestrianMaterialRef.current = null;
      vehicleBoxRef.current = null;
      trajectoryGeometryRef.current = null;
      trajectoryPositionAttributeRef.current = null;
      collisionGeometryRef.current = null;
      collisionPositionAttributeRef.current = null;

      // 공유 BoxGeometry는 한 번만 dispose하고 각 Material과 BufferGeometry는 소유자가 정리한다.
      lidarGeometry.dispose();
      lidarMaterial.dispose();
      boxGeometry.dispose();
      pedestrianMaterial.dispose();
      vehicleMaterial.dispose();
      trajectoryGeometry.dispose();
      trajectoryMaterial.dispose();
      collisionGeometry.dispose();
      collisionMaterial.dispose();
      grid.dispose();
      scene.clear();
      renderer.dispose();
    };
  }, [canvasRef, scenario, setSelectedObjectId]);

  // LiDAR Frame을 새 Geometry로 교체하지 않고 마운트 때 만든 위치 Buffer에 복사한다.
  useEffect(() => {
    const geometry = lidarGeometryRef.current;
    const attribute = lidarPositionAttributeRef.current;
    if (!geometry || !attribute) return;
    if (!lidarFrame) {
      geometry.setDrawRange(0, 0);
      return;
    }

    (attribute.array as Float32Array).set(lidarFrame.positions);
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, lidarFrame.positions.length / 3);
    geometry.computeBoundingSphere();
  }, [lidarFrame]);

  // Detection 데이터는 순수 값으로 유지하고 여기서만 Three.js Mesh transform으로 바꾼다.
  useEffect(() => {
    const pedestrianBox = pedestrianBoxRef.current;
    if (!pedestrianBox) return;
    if (!pedestrian) {
      pedestrianBox.visible = false;
      delete pedestrianBox.userData.objectId;
      return;
    }

    const [centerX, centerY, centerZ] = pedestrian.center;
    const [width, length, height] = pedestrian.size;
    pedestrianBox.position.set(centerX, centerY, centerZ);
    pedestrianBox.scale.set(width, height, length);
    pedestrianBox.rotation.set(0, pedestrian.yawRadians, 0);
    pedestrianBox.userData.objectId = pedestrian.id;
    pedestrianBox.visible = true;
  }, [pedestrian]);

  // 선택 피드백은 새 Material을 만들지 않고 기존 uniform 색상만 바꾼다.
  useEffect(() => {
    const material = pedestrianMaterialRef.current;
    if (!material) return;
    const isSelected =
      selectedObjectId !== null && selectedObjectId === pedestrian?.id;
    material.color.setHex(
      isSelected ? PEDESTRIAN_SELECTED_COLOR : PEDESTRIAN_DEFAULT_COLOR,
    );
  }, [pedestrian?.id, selectedObjectId]);

  // Vehicle State의 지면 기준 위치를 3D 박스 중심 위치로 변환한다.
  useEffect(() => {
    const vehicleBox = vehicleBoxRef.current;
    if (!vehicleBox) return;
    if (!vehicleStateFrame) {
      vehicleBox.visible = false;
      return;
    }

    const [positionX, groundY, positionZ] = vehicleStateFrame.position;
    const [width, length, height] = scenario.egoVehicleSize;
    vehicleBox.position.set(positionX, groundY + height / 2, positionZ);
    vehicleBox.scale.set(width, height, length);
    vehicleBox.rotation.set(0, vehicleStateFrame.yawRadians, 0);
    vehicleBox.visible = true;
  }, [scenario.egoVehicleSize, vehicleStateFrame]);

  // Planning Frame이 바뀔 때만 예상 경로의 재사용 Buffer를 갱신한다.
  useEffect(() => {
    const geometry = trajectoryGeometryRef.current;
    const attribute = trajectoryPositionAttributeRef.current;
    if (!geometry || !attribute) return;
    if (!trajectoryFrame) {
      geometry.setDrawRange(0, 0);
      return;
    }

    const positions = attribute.array as Float32Array;
    trajectoryFrame.points.forEach((point, index) => {
      const offset = index * 3;
      positions[offset] = point.position[0];
      positions[offset + 1] = point.position[1] + TRAJECTORY_RENDER_HEIGHT;
      positions[offset + 2] = point.position[2];
    });
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, trajectoryFrame.points.length);
    geometry.computeBoundingSphere();
  }, [trajectoryFrame]);

  // 충돌 계산은 데이터 계층의 순수 함수가 담당하고, 이 effect는 결과를 그리기만 한다.
  useEffect(() => {
    const geometry = collisionGeometryRef.current;
    const attribute = collisionPositionAttributeRef.current;
    if (!geometry || !attribute) return;
    if (!trajectoryFrame || !pedestrian) {
      geometry.setDrawRange(0, 0);
      return;
    }

    const collisionSegments = findAxisAlignedTrajectoryCollisionSegments(
      trajectoryFrame.points,
      pedestrian,
      scenario.egoVehicleSize,
    );
    const positions = attribute.array as Float32Array;
    collisionSegments.forEach((segment, segmentIndex) => {
      [segment.start, segment.end].forEach((position, endpointIndex) => {
        const offset = (segmentIndex * 2 + endpointIndex) * 3;
        positions[offset] = position[0];
        positions[offset + 1] = position[1] + COLLISION_RENDER_HEIGHT;
        positions[offset + 2] = position[2];
      });
    });
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, collisionSegments.length * 2);
    if (collisionSegments.length > 0) geometry.computeBoundingSphere();
  }, [pedestrian, scenario.egoVehicleSize, trajectoryFrame]);

  return { framesPerSecond };
}
