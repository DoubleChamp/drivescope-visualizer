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
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(
    manifest.lidar.frames[0].pointCount *
      3 *
      Float32Array.BYTES_PER_ELEMENT,
    24,
  );
  assert.equal(manifest.camera.frames[1].timestampMs, 500);
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

  const sourceTimestampUs = 1_500_999;
  const timestampOriginUs = Number(manifest.source.timestampOriginUs);
  const relativeTimestampMs = Math.floor(
    (sourceTimestampUs - timestampOriginUs) / 1_000,
  );

  assert.equal(relativeTimestampMs, 500);
}

console.log(
  `DriveScope manifest 검증 완료 (${manifestPath}): LiDAR ${manifest.lidar.frames.length}개, Camera ${manifest.camera.frames.length}개`,
);
