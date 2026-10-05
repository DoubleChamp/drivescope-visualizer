import unittest
import json
import tempfile
from pathlib import Path

import numpy as np

from convert_nuscenes_mini import (
    relative_timestamp_ms,
    scenario_ego_matrix_to_viewer_pose,
    source_xyz_to_viewer_xyz,
    collect_sensor_sweeps,
    convert_scene,
)


class ConvertNuScenesMiniTest(unittest.TestCase):
    def test_scene_sweeps_are_bounded_and_validated(self) -> None:
        frames = [{"token": str(i), "timestamp": i * 50_000,
                   "next": str(i + 1) if i < 3 else "", "calibrated_sensor_token": "lidar"}
                  for i in range(4)]
        class Records:
            def get(self, table, token):
                return frames[int(token)]
        nusc = Records()
        self.assertEqual(collect_sensor_sweeps(nusc, [frames[0], frames[2]]), frames[:3])
        frames[1]["next"] = "0"
        with self.assertRaises(ValueError):
            collect_sensor_sweeps(nusc, [frames[0], frames[2]])
        frames[1]["next"] = ""
        with self.assertRaises(ValueError):
            collect_sensor_sweeps(nusc, [frames[0], frames[2]])
        frames[1]["next"] = "2"
        frames[1]["calibrated_sensor_token"] = "camera"
        with self.assertRaises(ValueError):
            collect_sensor_sweeps(nusc, [frames[0], frames[2]])

    def test_conversion_compensates_ego_but_preserves_object_trail(self) -> None:
        # ego는 매 sweep 1m 전진한다. 정적 점은 10m, 움직이는 점은 매번 0.5m 이동한다.
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            identity = [1, 0, 0, 0]
            tables = {"sample": {}, "sample_data": {}, "ego_pose": {}, "calibrated_sensor": {}}
            for channel in ["lidar", "camera"]:
                tables["calibrated_sensor"][channel] = {"translation": [1, 0, 0], "rotation": identity}
                for i in range(5):
                    token = f"{channel}{i}"
                    filename = token + (".bin" if channel == "lidar" else ".jpg")
                    tables["sample_data"][token] = {
                        "token": token, "timestamp": i * 50_000, "next": f"{channel}{i+1}" if i < 4 else "",
                        "calibrated_sensor_token": channel, "ego_pose_token": str(i), "filename": filename,
                    }
                    if channel == "lidar":
                        np.array([[9-i, 0, 0, 1, 0], [9-i+i*.5, 2, 0, 1, 0]], dtype=np.float32).tofile(root / filename)
                    else:
                        (root / filename).write_bytes(b"test camera")
                    tables["ego_pose"][str(i)] = {"translation": [i, 0, 0], "rotation": identity}
            for i in [0, 4]:
                tables["sample"][str(i)] = {"data": {"LIDAR_TOP": f"lidar{i}", "CAM_FRONT": f"camera{i}"},
                    "next": "4" if i == 0 else ""}
            class Records:
                scene = [{"name": "test-scene", "token": "scene", "first_sample_token": "0", "nbr_samples": 2}]
                def get(self, table, token):
                    return tables[table][token]
            nusc = Records()
            baseline = convert_scene(nusc, root, root / "keyframes", 0)
            native = convert_scene(nusc, root, root / "native", 0, include_sweeps=True)
            stacked = convert_scene(nusc, root, root / "stacked", 0, include_sweeps=True, lidar_sweeps=3)
            manifest = json.loads((stacked / "manifest.json").read_text())
            provenance = json.loads((stacked / "conversion.json").read_text())
            self.assertEqual(provenance["lidarSweeps"], 3)
            self.assertFalse(provenance["objectMotionCompensated"])
            self.assertFalse(provenance["perPointTimestampsStored"])
            self.assertFalse((baseline / "conversion.json").exists())
            self.assertEqual([f["pointCount"] for f in manifest["lidar"]["frames"]], [2, 4, 6, 6, 6])
            self.assertEqual([f["timestampMs"] for f in manifest["lidar"]["frames"]], [0, 50, 100, 150, 200])
            for index, frame in enumerate(manifest["lidar"]["frames"]):
                xyz = np.fromfile(stacked / frame["positionsFile"], dtype="<f4").reshape(-1, 3)
                np.testing.assert_allclose(xyz[::2], np.tile([0, 0, -10], (len(xyz)//2, 1)))
                np.testing.assert_allclose(xyz[1::2, 2], [-10-j*.5 for j in range(max(0, index-2), index+1)])
            for filename in ["000000.bin", "000200.bin"]:
                self.assertEqual((baseline / "lidar" / filename).read_bytes(), (native / "lidar" / filename).read_bytes())
            self.assertEqual(len(json.loads((native / "manifest.json").read_text())["camera"]["frames"]), 5)
            with self.assertRaises(FileExistsError):
                convert_scene(nusc, root, root / "native", 0, include_sweeps=True)
            with self.assertRaises(ValueError):
                convert_scene(nusc, root, root / "invalid", 0, lidar_sweeps=3)

    def test_relative_timestamp_uses_integer_floor(self) -> None:
        self.assertEqual(relative_timestamp_ms(1_500_999, 1_000_000), 500)

    def test_relative_timestamp_rejects_time_before_origin(self) -> None:
        with self.assertRaises(ValueError):
            relative_timestamp_ms(999_999, 1_000_000)

    def test_source_axes_are_mapped_to_viewer_axes(self) -> None:
        source_basis_points = np.eye(3, dtype=np.float64)
        viewer_points = source_xyz_to_viewer_xyz(source_basis_points)

        np.testing.assert_allclose(
            viewer_points,
            np.array(
                [
                    [0.0, 0.0, -1.0],
                    [-1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                ]
            ),
        )

    def test_axis_mapping_preserves_handedness(self) -> None:
        viewer_basis = source_xyz_to_viewer_xyz(np.eye(3))

        self.assertAlmostEqual(float(np.linalg.det(viewer_basis)), 1.0)
        np.testing.assert_allclose(
            np.cross(viewer_basis[0], viewer_basis[1]), viewer_basis[2]
        )

    def test_first_ego_pose_becomes_viewer_origin(self) -> None:
        position, yaw_radians = scenario_ego_matrix_to_viewer_pose(np.eye(4))

        np.testing.assert_allclose(position, [0.0, 0.0, 0.0])
        self.assertAlmostEqual(yaw_radians, 0.0)

    def test_ego_translation_and_yaw_are_mapped_to_viewer_axes(self) -> None:
        scenario_from_ego = np.array(
            [
                [0.0, -1.0, 0.0, 10.0],
                [1.0, 0.0, 0.0, 2.0],
                [0.0, 0.0, 1.0, 1.0],
                [0.0, 0.0, 0.0, 1.0],
            ]
        )

        position, yaw_radians = scenario_ego_matrix_to_viewer_pose(
            scenario_from_ego
        )

        np.testing.assert_allclose(position, [-2.0, 1.0, -10.0])
        self.assertAlmostEqual(yaw_radians, np.pi / 2)

    def test_yaw_forward_matches_transformed_source_forward(self) -> None:
        for source_yaw in [0.0, np.pi / 2, -np.pi / 2, np.pi, 0.7]:
            with self.subTest(source_yaw=source_yaw):
                cosine, sine = np.cos(source_yaw), np.sin(source_yaw)
                pose = np.eye(4)
                pose[:3, :3] = [[cosine, -sine, 0], [sine, cosine, 0], [0, 0, 1]]
                _, viewer_yaw = scenario_ego_matrix_to_viewer_pose(pose)
                viewer_forward = [-np.sin(viewer_yaw), 0, -np.cos(viewer_yaw)]
                expected = source_xyz_to_viewer_xyz(pose[:3, 0].reshape(3, 1))[0]
                np.testing.assert_allclose(viewer_forward, expected, atol=1e-12)


if __name__ == "__main__":
    unittest.main()
