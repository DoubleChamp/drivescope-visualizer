from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

os.environ.setdefault(
    "MPLCONFIGDIR",
    str(Path(tempfile.gettempdir()) / "drivescope-matplotlib"),
)

import numpy as np
from nuscenes.nuscenes import NuScenes
from nuscenes.utils.data_classes import LidarPointCloud
from nuscenes.utils.geometry_utils import transform_matrix
from pyquaternion import Quaternion


NUSCENES_VERSION = "v1.0-mini"
LIDAR_CHANNEL = "LIDAR_TOP"
CAMERA_CHANNEL = "CAM_FRONT"


def relative_timestamp_ms(timestamp_us: int, timestamp_origin_us: int) -> int:
    if timestamp_us < timestamp_origin_us:
        raise ValueError("Frame timestamp는 timestamp origin보다 빠를 수 없습니다.")

    return (timestamp_us - timestamp_origin_us) // 1_000


def source_xyz_to_viewer_xyz(source_xyz: np.ndarray) -> np.ndarray:
    if source_xyz.ndim != 2 or source_xyz.shape[0] != 3:
        raise ValueError("source_xyz는 3×N 좌표 배열이어야 합니다.")

    # nuScenes ego 축(x=앞, y=왼쪽, z=위)을 Viewer 축(X=오른쪽, Y=위, Z=앞)으로 바꾼다.
    return np.column_stack((-source_xyz[1], source_xyz[2], source_xyz[0]))


def pose_matrix(record: dict[str, Any], *, inverse: bool = False) -> np.ndarray:
    return transform_matrix(
        np.asarray(record["translation"], dtype=np.float64),
        Quaternion(record["rotation"]),
        inverse=inverse,
    )


def collect_scene_samples(nusc: NuScenes, scene: dict[str, Any]) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    sample_token = scene["first_sample_token"]

    while sample_token:
        sample = nusc.get("sample", sample_token)
        samples.append(sample)
        sample_token = sample["next"]

    if len(samples) != scene["nbr_samples"]:
        raise ValueError(
            f"scene sample 수가 metadata와 다릅니다: {len(samples)} != {scene['nbr_samples']}"
        )

    return samples


def get_sensor_frames(
    nusc: NuScenes,
    samples: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    lidar_frames = [
        nusc.get("sample_data", sample["data"][LIDAR_CHANNEL]) for sample in samples
    ]
    camera_frames = [
        nusc.get("sample_data", sample["data"][CAMERA_CHANNEL]) for sample in samples
    ]
    return lidar_frames, camera_frames


def require_source_file(dataroot: Path, relative_path: str) -> Path:
    source_path = dataroot / Path(relative_path)
    if not source_path.is_file():
        raise FileNotFoundError(f"nuScenes 원본 파일을 찾을 수 없습니다: {source_path}")
    return source_path


def unique_output_name(timestamp_ms: int, suffix: str, used_names: set[str]) -> str:
    output_name = f"{timestamp_ms:06d}{suffix.lower()}"
    if output_name in used_names:
        raise ValueError(f"상대 timestamp가 중복되어 출력 파일명이 겹칩니다: {output_name}")
    used_names.add(output_name)
    return output_name


def convert_scene(
    nusc: NuScenes,
    dataroot: Path,
    output_root: Path,
    scene_index: int,
) -> Path:
    if scene_index < 0 or scene_index >= len(nusc.scene):
        raise IndexError(f"scene-index는 0 이상 {len(nusc.scene) - 1} 이하여야 합니다.")

    scene = nusc.scene[scene_index]
    scenario_id = scene["name"]
    samples = collect_scene_samples(nusc, scene)
    lidar_source_frames, camera_source_frames = get_sensor_frames(nusc, samples)

    timestamp_origin_us = min(
        int(frame["timestamp"])
        for frame in [*lidar_source_frames, *camera_source_frames]
    )

    first_lidar_pose = nusc.get(
        "ego_pose",
        lidar_source_frames[0]["ego_pose_token"],
    )
    scenario_from_global = pose_matrix(first_lidar_pose, inverse=True)

    output_root.mkdir(parents=True, exist_ok=True)
    destination = output_root / scenario_id
    if destination.exists():
        raise FileExistsError(
            f"출력 디렉터리가 이미 존재합니다. 기존 결과를 보존하기 위해 중단합니다: {destination}"
        )

    temporary_output = Path(
        tempfile.mkdtemp(prefix=f".{scenario_id}-", dir=output_root)
    )

    try:
        lidar_directory = temporary_output / "lidar"
        camera_directory = temporary_output / "camera"
        lidar_directory.mkdir()
        camera_directory.mkdir()

        lidar_frames: list[dict[str, int | str]] = []
        camera_frames: list[dict[str, int | str]] = []
        used_lidar_names: set[str] = set()
        used_camera_names: set[str] = set()

        for source_frame in lidar_source_frames:
            timestamp_ms = relative_timestamp_ms(
                int(source_frame["timestamp"]), timestamp_origin_us
            )
            source_path = require_source_file(dataroot, source_frame["filename"])
            point_cloud = LidarPointCloud.from_file(str(source_path))

            calibrated_sensor = nusc.get(
                "calibrated_sensor", source_frame["calibrated_sensor_token"]
            )
            ego_pose = nusc.get("ego_pose", source_frame["ego_pose_token"])
            sensor_to_scenario = (
                scenario_from_global
                @ pose_matrix(ego_pose)
                @ pose_matrix(calibrated_sensor)
            )
            point_cloud.transform(sensor_to_scenario)
            viewer_points = source_xyz_to_viewer_xyz(point_cloud.points[:3])

            if not np.isfinite(viewer_points).all():
                raise ValueError(f"유한하지 않은 LiDAR 좌표가 있습니다: {source_path}")

            output_name = unique_output_name(
                timestamp_ms, ".bin", used_lidar_names
            )
            output_path = lidar_directory / output_name
            little_endian_points = np.asarray(
                viewer_points,
                dtype=np.dtype("<f4"),
                order="C",
            )
            little_endian_points.tofile(output_path)

            point_count = int(little_endian_points.shape[0])
            expected_size = point_count * 3 * np.dtype("<f4").itemsize
            if output_path.stat().st_size != expected_size:
                raise ValueError(f"LiDAR 출력 크기가 예상과 다릅니다: {output_path}")

            lidar_frames.append(
                {
                    "timestampMs": timestamp_ms,
                    "positionsFile": f"lidar/{output_name}",
                    "pointCount": point_count,
                }
            )

        for source_frame in camera_source_frames:
            timestamp_ms = relative_timestamp_ms(
                int(source_frame["timestamp"]), timestamp_origin_us
            )
            source_path = require_source_file(dataroot, source_frame["filename"])
            output_name = unique_output_name(
                timestamp_ms, source_path.suffix, used_camera_names
            )
            shutil.copy2(source_path, camera_directory / output_name)
            camera_frames.append(
                {
                    "timestampMs": timestamp_ms,
                    "imageFile": f"camera/{output_name}",
                }
            )

        lidar_frames.sort(key=lambda frame: int(frame["timestampMs"]))
        camera_frames.sort(key=lambda frame: int(frame["timestampMs"]))
        duration_ms = max(
            int(lidar_frames[-1]["timestampMs"]),
            int(camera_frames[-1]["timestampMs"]),
        )

        manifest = {
            "schemaVersion": 1,
            "scenarioId": scenario_id,
            "durationMs": duration_ms,
            "coordinateSystem": "x-right-y-up-z-forward-meters",
            "source": {
                "dataset": "nuScenes",
                "sceneToken": scene["token"],
                "timestampOriginUs": str(timestamp_origin_us),
            },
            "lidar": {
                "channel": LIDAR_CHANNEL,
                "positionEncoding": "float32-le-xyz",
                "frames": lidar_frames,
            },
            "camera": {
                "channel": CAMERA_CHANNEL,
                "frames": camera_frames,
            },
        }

        manifest_path = temporary_output / "manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_output.rename(destination)
    except Exception:
        shutil.rmtree(temporary_output, ignore_errors=True)
        raise

    return destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="nuScenes mini scene을 DriveScope 디스크 포맷 v1로 변환합니다."
    )
    parser.add_argument(
        "--dataroot",
        type=Path,
        required=True,
        help="v1.0-mini, samples, sweeps 폴더가 있는 nuScenes 루트",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        required=True,
        help="scene 디렉터리를 생성할 출력 루트",
    )
    parser.add_argument(
        "--scene-index",
        type=int,
        default=0,
        help="변환할 mini scene 인덱스(기본값: 0)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dataroot = args.dataroot.resolve()
    output_root = args.output_root.resolve()

    if not (dataroot / NUSCENES_VERSION).is_dir():
        raise FileNotFoundError(
            f"{NUSCENES_VERSION} metadata 폴더를 찾을 수 없습니다: {dataroot}"
        )

    nusc = NuScenes(version=NUSCENES_VERSION, dataroot=str(dataroot), verbose=False)
    destination = convert_scene(nusc, dataroot, output_root, args.scene_index)
    manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))

    print(f"DriveScope 변환 완료: {destination}")
    print(
        f"LiDAR {len(manifest['lidar']['frames'])}개, "
        f"Camera {len(manifest['camera']['frames'])}개, "
        f"길이 {manifest['durationMs']}ms"
    )


if __name__ == "__main__":
    main()
