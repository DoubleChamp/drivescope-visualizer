import type * as ManifestModule from "../app/viewer/_data/drivescope-manifest";

const assert = require("node:assert/strict");
const { readFileSync, statSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { parseDriveScopeManifest } = require(
  "../app/viewer/_data/drivescope-manifest.ts",
) as typeof ManifestModule;

const requestedPath = process.argv[2];
const fixturePath = join(process.cwd(), "fixtures", "drivescope-manifest.json");
const manifestPath = requestedPath ? resolve(requestedPath) : fixturePath;
const manifest = parseDriveScopeManifest(
  JSON.parse(readFileSync(manifestPath, "utf8")),
);

if (requestedPath) {
  const assetRoot = dirname(manifestPath);

  for (const frame of manifest.lidar.frames) {
    const positionsPath = join(assetRoot, ...frame.positionsFile.split("/"));
    const expectedByteLength =
      frame.pointCount * 3 * Float32Array.BYTES_PER_ELEMENT;
    assert.equal(statSync(positionsPath).size, expectedByteLength);
  }

  for (const frame of manifest.camera.frames) {
    const imagePath = join(assetRoot, ...frame.imageFile.split("/"));
    assert.equal(statSync(imagePath).isFile(), true);
  }
} else {
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(
    manifest.lidar.frames[0].pointCount *
      3 *
      Float32Array.BYTES_PER_ELEMENT,
    24,
  );
  assert.equal(manifest.camera.frames[1].timestampMs, 500);
  assert.deepEqual(manifest.egoVehicle.frames[0].position, [0, 0, 0]);
  assert.equal(manifest.egoVehicle.frames[1].position[2], -2);
  assert.throws(
    () =>
      parseDriveScopeManifest({
        ...manifest,
        schemaVersion: 2,
      }),
    /schemaVersion.*3/,
  );
  assert.throws(
    () =>
      parseDriveScopeManifest({
        ...manifest,
        coordinateSystem: "x-right-y-up-z-forward-meters",
      }),
    /coordinateSystem.*z-backward/,
  );
  assert.throws(
    () =>
      parseDriveScopeManifest({
        ...manifest,
        lidar: {
          ...manifest.lidar,
          frames: [
            {
              ...manifest.lidar.frames[0],
              positionsFile: "../outside.bin",
            },
          ],
        },
      }),
    /안전한 상대 경로/,
  );
  assert.throws(
    () =>
      parseDriveScopeManifest({
        ...manifest,
        egoVehicle: {
          frames: [
            {
              ...manifest.egoVehicle.frames[0],
              position: [0, 0],
            },
          ],
        },
      }),
    /숫자 3개의 좌표 배열/,
  );

  const sourceTimestampUs = 1_500_999;
  const timestampOriginUs = Number(manifest.source.timestampOriginUs);
  const relativeTimestampMs = Math.floor(
    (sourceTimestampUs - timestampOriginUs) / 1_000,
  );

  assert.equal(relativeTimestampMs, 500);
}

console.log(
  `DriveScope manifest 검증 완료 (${manifestPath}): LiDAR ${manifest.lidar.frames.length}개, Camera ${manifest.camera.frames.length}개, Ego pose ${manifest.egoVehicle.frames.length}개`,
);
