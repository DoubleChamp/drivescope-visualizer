import {
  parseDriveScopeManifest,
  type DriveScopeManifest,
} from "./drivescope-manifest";
import type { CameraFrame } from "./frame-types";
import type { LidarFrameSource } from "./lidar-frame-source";

export const DRIVE_SCOPE_MANIFEST_URL =
  process.env.NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL?.trim() ||
  "/api/drivescope-data/manifest.json";

type LidarManifestFrame = DriveScopeManifest["lidar"]["frames"][number];

export type DriveScopeDataSource = LidarFrameSource & {
  manifest: DriveScopeManifest;
  frames: readonly LidarManifestFrame[];
  cameraFrames: readonly CameraFrame[];
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
    const reason =
      manifestResponse.status === 404
        ? "데이터 목록 파일(manifest.json)을 찾을 수 없습니다."
        : manifestResponse.status === 503
          ? "서버의 데이터 연결 설정을 확인하세요."
          : "서버에서 데이터 목록 파일을 읽지 못했습니다.";
    throw new Error(
      `${reason} HTTP ${manifestResponse.status}`,
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
      if (!frameMetadata) return { frame: null, timings: null };

      const positionsUrl = new URL(frameMetadata.positionsFile, manifestBaseUrl);
      const requestStartedAt = performance.now();
      const positionsResponse = await fetch(positionsUrl, { cache: "no-store" });
      // fetch는 본문 전체가 아니라 응답 헤더를 받은 시점에 완료된다.
      const headersReceivedAt = performance.now();
      if (!positionsResponse.ok) {
        throw new Error(
          `LiDAR Frame 로딩 실패 (${timestampMs}ms): HTTP ${positionsResponse.status}`,
        );
      }

      const positionsBuffer = await positionsResponse.arrayBuffer();
      const bodyReadAt = performance.now();
      const expectedByteLength =
        frameMetadata.pointCount * 3 * Float32Array.BYTES_PER_ELEMENT;
      if (positionsBuffer.byteLength !== expectedByteLength) {
        throw new Error(
          `LiDAR Frame ${timestampMs}ms의 크기가 예상과 다릅니다: ` +
            `${positionsBuffer.byteLength} / ${expectedByteLength}바이트`,
        );
      }

      const positions = decodeLittleEndianPositions(positionsBuffer);
      const positionsPreparedAt = performance.now();

      return {
        frame: { timestampMs, positions },
        timings: {
          responseHeadersMs: headersReceivedAt - requestStartedAt,
          responseBodyMs: bodyReadAt - headersReceivedAt,
          preparePositionsMs: positionsPreparedAt - bodyReadAt,
        },
      };
    },
  };
}
