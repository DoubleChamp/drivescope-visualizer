import type * as ManifestModule from "../app/viewer/_data/drivescope-manifest";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { parseDriveScopeManifest } = require(
  "../app/viewer/_data/drivescope-manifest.ts",
) as typeof ManifestModule;

const fixturePath = join(process.cwd(), "fixtures", "drivescope-manifest.json");
const manifest = parseDriveScopeManifest(
  JSON.parse(readFileSync(fixturePath, "utf8")),
);

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.lidar.frames[0].pointCount * 3 * Float32Array.BYTES_PER_ELEMENT, 24);
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
const relativeTimestampMs = Math.floor((sourceTimestampUs - timestampOriginUs) / 1_000);

assert.equal(relativeTimestampMs, 500);

console.log(
  `DriveScope manifest 검증 완료: LiDAR ${manifest.lidar.frames.length}개, Camera ${manifest.camera.frames.length}개`,
);
