import unittest

import numpy as np

from convert_nuscenes_mini import relative_timestamp_ms, source_xyz_to_viewer_xyz


class ConvertNuScenesMiniTest(unittest.TestCase):
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
                    [0.0, 0.0, 1.0],
                    [-1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                ]
            ),
        )


if __name__ == "__main__":
    unittest.main()
