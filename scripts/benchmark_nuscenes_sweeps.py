"""한 scene의 세 v3 변환 결과와 ego 보정 뒤 객체 잔상 proxy를 만든다. 원본은 Git에 넣지 않는다."""
from __future__ import annotations

import argparse
import json
import hashlib
import platform
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

from convert_nuscenes_mini import (collect_scene_samples, get_sensor_frames, collect_sensor_sweeps,
                                  convert_scene, pose_matrix, require_source_file)
import numpy as np
from nuscenes.nuscenes import NuScenes
from nuscenes.utils.data_classes import LidarPointCloud
from nuscenes.utils.geometry_utils import points_in_box


def stats(values):
    if not values:
        return {"count": 0, "mean": None, "p95": None, "max": None, "min": None}
    ordered = np.sort(values)
    return {"count": len(values), "mean": float(np.mean(ordered)), "p95": float(ordered[int(np.ceil(len(values)*.95))-1]),
            "min": float(ordered[0]), "max": float(ordered[-1])}


def dataset_metrics(destination):
    manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))
    lidar = manifest["lidar"]["frames"]
    camera = manifest["camera"]["frames"]
    sizes = [f["pointCount"] * 12 for f in lidar]
    return {"lidarFrameCount": len(lidar), "cameraFrameCount": len(camera), "durationMs": manifest["durationMs"],
            "lidarIntervalMs": stats(np.diff([f["timestampMs"] for f in lidar]).tolist()),
            "cameraIntervalMs": stats(np.diff([f["timestampMs"] for f in camera]).tolist()),
            "pointCount": stats([f["pointCount"] for f in lidar]), "lidarPayloadBytes": sum(sizes),
            "cameraPayloadBytes": sum((destination / f["imageFile"]).stat().st_size for f in camera),
            "fiveLargestCpuBuffersBytes": sum(sorted(sizes)[-5:]), "gpuPositionBufferBytes": max(sizes),
            "manifestSha256": hashlib.sha256((destination / "manifest.json").read_bytes()).hexdigest()}


def density_metrics(destinations):
    baseline = json.loads((destinations["keyframes"] / "manifest.json").read_text(encoding="utf-8"))
    poses = {f["timestampMs"]: f["position"] for f in baseline["egoVehicle"]["frames"]}
    measurements = []
    for frame in baseline["lidar"]["frames"][1:]:
        position = np.asarray(poses[frame["timestampMs"]])
        row = {"timestampMs": frame["timestampMs"]}
        for variant in ["individual", "accumulated5"]:
            xyz = np.fromfile(destinations[variant] / frame["positionsFile"], dtype="<f4").reshape(-1, 3)
            xyz = xyz - position
            roi = (np.abs(xyz[:, 0]) <= 25) & (np.abs(xyz[:, 2]) <= 25) & (xyz[:, 1] >= -3) & (xyz[:, 1] <= 8)
            points = xyz[roi]
            voxels = np.floor(points / .25).astype(np.int32)
            row[variant] = {"roiPoints": len(points), "pointsPerSquareMeter": len(points) / 2500,
                            "occupiedQuarterMeterVoxels": int(len(np.unique(voxels, axis=0)))}
        measurements.append(row)
    return {"method": f"{len(measurements)} shared keyframe times after startup; square +/-25m viewer X/Z around current ego, height [-3,8]m relative to ego; 2500m2; 0.25m 3D voxels; no static/dynamic segmentation",
            "summaries": {v: {metric: stats([row[v][metric] for row in measurements])
                               for metric in measurements[0][v]} for v in ["individual", "accumulated5"]},
            "measurements": measurements}


def object_trails(nusc, dataroot, frames, keyframes, count, figure_path):
    # 단일 keyframe annotation을 기준으로, 과거 interpolated box 내부 점이 지금 box 밖에 남는지 센다.
    # 객체 식별/분할 ground truth가 아니며 box 크기·보간·가림에 영향을 받는 proxy다.
    indices = {f["token"]: i for i, f in enumerate(frames)}
    cloud_cache = {}
    box_cache = {}
    def global_points(frame):
        token = frame["token"]
        if token not in cloud_cache:
            pc = LidarPointCloud.from_file(str(require_source_file(dataroot, frame["filename"])))
            pc.transform(pose_matrix(nusc.get("ego_pose", frame["ego_pose_token"])) @
                         pose_matrix(nusc.get("calibrated_sensor", frame["calibrated_sensor_token"])))
            cloud_cache[token] = pc.points[:3]
        return cloud_cache[token]
    def boxes(frame):
        token = frame["token"]
        if token not in box_cache:
            box_cache[token] = {nusc.get("sample_annotation", b.token)["instance_token"]: b
                                for b in nusc.get_boxes(token)}
        return box_cache[token]
    measurements = []
    examples = []
    for current in keyframes:
        index = indices[current["token"]]
        previous = frames[max(0, index-count+1):index]
        for instance, box in boxes(current).items():
            velocity = nusc.box_velocity(box.token)
            if not np.isfinite(velocity).all() or np.linalg.norm(velocity[:2]) < 1:
                continue
            expanded = box.copy()
            expanded.wlh += .5  # 모든 면에 0.25m 여유; 경계 오차에 대한 과민 집계 완화.
            pieces = []
            selected_count = outside_count = 0
            displacements = []
            for old in previous:
                old_box = boxes(old).get(instance)
                if old_box is None:
                    continue
                pts = global_points(old)
                selected = pts[:, points_in_box(old_box, pts)]
                if selected.shape[1] == 0:
                    continue
                outside = ~points_in_box(expanded, selected)
                selected_count += selected.shape[1]
                outside_count += int(outside.sum())
                displacements.append(float(np.linalg.norm(old_box.center-box.center)))
                pieces.append((old, selected, old_box))
            if selected_count:
                row = {"referenceTimestampUs": str(current["timestamp"]), "category": box.name,
                       "estimatedSpeedMps": float(np.linalg.norm(velocity[:2])), "pastBoxPoints": selected_count,
                       "pastPointsOutsideCurrentExpandedBox": outside_count,
                       "outsideFraction": outside_count / selected_count, "maxCenterTrailM": max(displacements)}
                measurements.append(row)
                examples.append((outside_count, current, box, pieces))
    assert measurements, "이 scene에는 측정할 moving box가 없습니다."
    worst = max(examples, key=lambda example: example[0])
    outside_count, current, box, pieces = worst
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 2, figsize=(10, 5), sharex=True, sharey=True)
    pts = global_points(current)
    center = box.center[:2]
    roi = (np.abs(pts[0]-center[0]) < 6) & (np.abs(pts[1]-center[1]) < 6)
    for axis in axes:
        axis.scatter(pts[0, roi]-center[0], pts[1, roi]-center[1], s=1, c="#009cd8", label="current sweep")
        corners = box.bottom_corners()[:2] - center[:, None]
        corners = np.column_stack([corners, corners[:, 0]])
        axis.plot(*corners, c="black", label="current annotated box")
        axis.set_aspect("equal"); axis.set_xlim(-6, 6); axis.set_ylim(-6, 6)
        axis.set_xlabel("global X relative to current box / m")
    for old, selected, old_box in pieces:
        age = (int(current["timestamp"])-int(old["timestamp"]))/1000
        axes[1].scatter(selected[0]-center[0], selected[1]-center[1], s=4, label=f"past object-box points: {age:.0f}ms")
    axes[0].set_title("Individual sweep")
    axes[1].set_title(f"Past {count} sweeps: {outside_count} points outside +0.25m box")
    axes[0].set_ylabel("global Y relative to current box / m")
    axes[1].legend(fontsize=7)
    fig.suptitle(f"{box.name}; raw timestamp {current['timestamp']}us\nEgo compensation only; past boxes interpolated by devkit")
    fig.tight_layout(); fig.savefig(figure_path, dpi=160); plt.close(fig)
    return {"method": "past points inside devkit-interpolated same-instance box, outside current keyframe box expanded 0.25m; speed estimate >=1m/s",
            "limitations": "geometric proxy, not semantic ghost ground truth; box interpolation, occlusion, overlap and boundary errors remain; no object motion compensation",
            "measurementCount": len(measurements), "pastBoxPoints": sum(m["pastBoxPoints"] for m in measurements),
            "pastPointsOutsideCurrentExpandedBox": sum(m["pastPointsOutsideCurrentExpandedBox"] for m in measurements),
            "maxCenterTrailM": stats([m["maxCenterTrailM"] for m in measurements]), "measurements": measurements,
            "figureReferenceTimestampUs": str(current["timestamp"])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataroot", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=Path("node_modules/.cache/drivescope-sweeps"))
    parser.add_argument("--scene-index", type=int, default=0)
    parser.add_argument("--analyze-only", action="store_true", help="이미 만든 세 변환 결과로 분석만 재실행")
    args = parser.parse_args()
    nusc = NuScenes(version="v1.0-mini", dataroot=str(args.dataroot), verbose=False)
    samples = collect_scene_samples(nusc, nusc.scene[args.scene_index])
    keyframes, _ = get_sensor_frames(nusc, samples)
    frames = collect_sensor_sweeps(nusc, keyframes)
    destinations = {}
    for variant, native, count in [("keyframes", False, 1), ("individual", True, 1), ("accumulated5", True, 5)]:
        if args.analyze_only:
            destinations[variant] = args.output_root / variant / nusc.scene[args.scene_index]["name"]
            manifest = json.loads((destinations[variant] / "manifest.json").read_text(encoding="utf-8"))
            expected_frames = keyframes if not native else frames
            origin = int(manifest["source"]["timestampOriginUs"])
            assert [f["timestampMs"] for f in manifest["lidar"]["frames"]] == [(int(f["timestamp"])-origin)//1000 for f in expected_frames]
            for i, frame in enumerate(manifest["lidar"]["frames"]):
                expected_points = sum(require_source_file(args.dataroot, f["filename"]).stat().st_size//20
                                      for f in expected_frames[max(0, i-count+1):i+1])
                assert frame["pointCount"] == expected_points
                assert (destinations[variant] / frame["positionsFile"]).stat().st_size == expected_points*12
        else:
            destinations[variant] = convert_scene(nusc, args.dataroot, args.output_root / variant, args.scene_index,
                                                 include_sweeps=native, lidar_sweeps=count)
        print(f"{variant}: {dataset_metrics(destinations[variant])['lidarFrameCount']} LiDAR frames")
    baseline = json.loads((destinations["keyframes"] / "manifest.json").read_text(encoding="utf-8"))
    for frame in baseline["lidar"]["frames"]:
        assert (destinations["keyframes"] / frame["positionsFile"]).read_bytes() == (destinations["individual"] / frame["positionsFile"]).read_bytes()
    ghost = object_trails(nusc, args.dataroot, frames, keyframes, 5, args.output_root / "object-trail.png")
    result = {"measuredAt": datetime.now(timezone.utc).isoformat(), "pythonVersion": platform.python_version(),
              "numpyVersion": np.__version__, "nuscenesDevkitVersion": version("nuscenes-devkit"),
              "scenarioId": nusc.scene[args.scene_index]["name"], "schemaVersion": 3, "accumulatedSweepCount": 5,
              "coordinatePolicy": "each sweep calibration + own ego -> global -> first LiDAR ego -> viewer; no object motion compensation",
              "windowPolicy": "first through last keyframe per sensor; current and at most 4 past sweeps; startup truncated",
              "variants": {v: dataset_metrics(p) for v, p in destinations.items()},
              "accumulationAgeMs": stats([(int(frames[i]["timestamp"])-int(frames[max(0, i-4)]["timestamp"]))/1000 for i in range(len(frames))]),
              "originalKeyframeBytesEqual": True, "density": density_metrics(destinations), "objectTrailProxy": ghost}
    (args.output_root / "offline.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"variants": result["variants"], "ghostMeasurementCount": ghost["measurementCount"]}, indent=2))


if __name__ == "__main__":
    main()
