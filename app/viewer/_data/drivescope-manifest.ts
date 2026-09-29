export const DRIVE_SCOPE_MANIFEST_VERSION = 1 as const;

export type DriveScopeManifest = {
  schemaVersion: typeof DRIVE_SCOPE_MANIFEST_VERSION;
  scenarioId: string;
  durationMs: number;
  coordinateSystem: "x-right-y-up-z-forward-meters";
  source: {
    dataset: "nuScenes";
    sceneToken: string;
    timestampOriginUs: string;
  };
  lidar: {
    channel: "LIDAR_TOP";
    positionEncoding: "float32-le-xyz";
    frames: Array<{
      timestampMs: number;
      positionsFile: string;
      pointCount: number;
    }>;
  };
  camera: {
    channel: "CAM_FRONT";
    frames: Array<{
      timestampMs: number;
      imageFile: string;
    }>;
  };
};

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(value: unknown, path: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`${path}는 객체여야 합니다.`);
  }

  return value;
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}는 비어 있지 않은 문자열이어야 합니다.`);
  }

  return value;
}

function readInteger(value: unknown, path: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path}는 ${minimum} 이상의 안전한 정수여야 합니다.`);
  }

  return value as number;
}

function readLiteral<T extends string | number>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) {
    throw new Error(`${path}는 ${JSON.stringify(expected)}이어야 합니다.`);
  }

  return expected;
}

function readRelativeAssetPath(value: unknown, path: string): string {
  const assetPath = readNonEmptyString(value, path);
  const segments = assetPath.split("/");

  if (
    assetPath.startsWith("/") ||
    assetPath.includes("\\") ||
    assetPath.includes("?") ||
    assetPath.includes("#") ||
    /^[a-z][a-z\d+.-]*:/i.test(assetPath) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`${path}는 manifest 기준의 안전한 상대 경로여야 합니다.`);
  }

  return assetPath;
}

function assertSortedTimestamps(
  frames: Array<{ timestampMs: number }>,
  durationMs: number,
  path: string,
) {
  let previousTimestampMs = -1;

  for (const [index, frame] of frames.entries()) {
    if (frame.timestampMs < previousTimestampMs) {
      throw new Error(`${path}[${index}].timestampMs는 오름차순이어야 합니다.`);
    }

    if (frame.timestampMs > durationMs) {
      throw new Error(`${path}[${index}].timestampMs는 durationMs를 넘을 수 없습니다.`);
    }

    previousTimestampMs = frame.timestampMs;
  }
}

export function parseDriveScopeManifest(value: unknown): DriveScopeManifest {
  const manifest = readObject(value, "manifest");
  const durationMs = readInteger(manifest.durationMs, "manifest.durationMs", 0);
  const source = readObject(manifest.source, "manifest.source");
  const lidar = readObject(manifest.lidar, "manifest.lidar");
  const camera = readObject(manifest.camera, "manifest.camera");

  if (!/^\d+$/.test(readNonEmptyString(source.timestampOriginUs, "manifest.source.timestampOriginUs"))) {
    throw new Error("manifest.source.timestampOriginUs는 음수가 아닌 정수 문자열이어야 합니다.");
  }

  if (!Array.isArray(lidar.frames)) {
    throw new Error("manifest.lidar.frames는 배열이어야 합니다.");
  }

  if (!Array.isArray(camera.frames)) {
    throw new Error("manifest.camera.frames는 배열이어야 합니다.");
  }

  const lidarFrames = lidar.frames.map((frameValue, index) => {
    const frame = readObject(frameValue, `manifest.lidar.frames[${index}]`);

    return {
      timestampMs: readInteger(
        frame.timestampMs,
        `manifest.lidar.frames[${index}].timestampMs`,
        0,
      ),
      positionsFile: readRelativeAssetPath(
        frame.positionsFile,
        `manifest.lidar.frames[${index}].positionsFile`,
      ),
      pointCount: readInteger(
        frame.pointCount,
        `manifest.lidar.frames[${index}].pointCount`,
        0,
      ),
    };
  });

  const cameraFrames = camera.frames.map((frameValue, index) => {
    const frame = readObject(frameValue, `manifest.camera.frames[${index}]`);

    return {
      timestampMs: readInteger(
        frame.timestampMs,
        `manifest.camera.frames[${index}].timestampMs`,
        0,
      ),
      imageFile: readRelativeAssetPath(
        frame.imageFile,
        `manifest.camera.frames[${index}].imageFile`,
      ),
    };
  });

  assertSortedTimestamps(lidarFrames, durationMs, "manifest.lidar.frames");
  assertSortedTimestamps(cameraFrames, durationMs, "manifest.camera.frames");

  return {
    schemaVersion: readLiteral(
      manifest.schemaVersion,
      DRIVE_SCOPE_MANIFEST_VERSION,
      "manifest.schemaVersion",
    ),
    scenarioId: readNonEmptyString(manifest.scenarioId, "manifest.scenarioId"),
    durationMs,
    coordinateSystem: readLiteral(
      manifest.coordinateSystem,
      "x-right-y-up-z-forward-meters",
      "manifest.coordinateSystem",
    ),
    source: {
      dataset: readLiteral(source.dataset, "nuScenes", "manifest.source.dataset"),
      sceneToken: readNonEmptyString(source.sceneToken, "manifest.source.sceneToken"),
      timestampOriginUs: source.timestampOriginUs as string,
    },
    lidar: {
      channel: readLiteral(lidar.channel, "LIDAR_TOP", "manifest.lidar.channel"),
      positionEncoding: readLiteral(
        lidar.positionEncoding,
        "float32-le-xyz",
        "manifest.lidar.positionEncoding",
      ),
      frames: lidarFrames,
    },
    camera: {
      channel: readLiteral(camera.channel, "CAM_FRONT", "manifest.camera.channel"),
      frames: cameraFrames,
    },
  };
}
