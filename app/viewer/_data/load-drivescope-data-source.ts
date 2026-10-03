import {
  parseDriveScopeManifest,
  type DriveScopeManifest,
} from "./drivescope-manifest";
import type { CameraFrame, LidarFrame } from "./frame-types";

export const DRIVE_SCOPE_MANIFEST_URL = "/api/drivescope-data/manifest.json";

type LidarManifestFrame = DriveScopeManifest["lidar"]["frames"][number];

export type DriveScopeDataSource = {
  id: string;
  manifest: DriveScopeManifest;
  frames: readonly LidarManifestFrame[];
  cameraFrames: readonly CameraFrame[];
  loadFrame: (timestampMs: number) => Promise<LidarFrame | null>;
};

const isLittleEndian = (() => {
  const value = new Uint16Array([1]);
  return new Uint8Array(value.buffer)[0] === 1;
})();

const decodeLittleEndianPositions = (buffer: ArrayBuffer) => {
  if (isLittleEndian) return new Float32Array(buffer);

  const view = new DataView(buffer);
  const positions = new Float32Array(
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
  for (let index = 0; index < positions.length; index += 1) {
    positions[index] = view.getFloat32(
      index * Float32Array.BYTES_PER_ELEMENT,
      true,
    );
  }
  return positions;
};

export async function loadDriveScopeDataSource(
  manifestUrl = DRIVE_SCOPE_MANIFEST_URL,
  signal?: AbortSignal,
): Promise<DriveScopeDataSource> {
  const manifestResponse = await fetch(manifestUrl, {
    cache: "no-store",
    signal,
  });
  if (!manifestResponse.ok) {
    throw new Error(
      `DriveScope manifest 로딩 실패: HTTP ${manifestResponse.status}`,
    );
  }

  const manifest = parseDriveScopeManifest(await manifestResponse.json());
  const manifestBaseUrl = manifestResponse.url;
  const framesByTimestamp = new Map(
    manifest.lidar.frames.map((frame) => [frame.timestampMs, frame]),
  );

  return {
    id: `drivescope:${manifest.scenarioId}`,
    manifest,
    frames: manifest.lidar.frames,
    cameraFrames: manifest.camera.frames.map((frame) => ({
      timestampMs: frame.timestampMs,
      imageUrl: new URL(frame.imageFile, manifestBaseUrl).href,
    })),
    async loadFrame(timestampMs) {
      const frameMetadata = framesByTimestamp.get(timestampMs);
      if (!frameMetadata) return null;

      const positionsUrl = new URL(frameMetadata.positionsFile, manifestBaseUrl);
      const positionsResponse = await fetch(positionsUrl, { cache: "no-store" });
      if (!positionsResponse.ok) {
        throw new Error(
          `LiDAR Frame 로딩 실패 (${timestampMs}ms): HTTP ${positionsResponse.status}`,
        );
      }

      const positionsBuffer = await positionsResponse.arrayBuffer();
      const expectedByteLength =
        frameMetadata.pointCount * 3 * Float32Array.BYTES_PER_ELEMENT;
      if (positionsBuffer.byteLength !== expectedByteLength) {
        throw new Error(
          `LiDAR Frame ${timestampMs}ms의 크기가 예상과 다릅니다: ` +
            `${positionsBuffer.byteLength} / ${expectedByteLength}바이트`,
        );
      }

      return {
        timestampMs,
        positions: decodeLittleEndianPositions(positionsBuffer),
      } satisfies LidarFrame;
    },
  };
}
