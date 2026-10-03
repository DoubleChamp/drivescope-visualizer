import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type RouteHandlerContext = {
  params: Promise<{ assetPath: string[] }>;
};

const isAllowedAssetPath = (assetPath: readonly string[]) =>
  (assetPath.length === 1 && assetPath[0] === "manifest.json") ||
  (assetPath.length === 2 &&
    assetPath[0] === "lidar" &&
    /^[\w.-]+\.bin$/.test(assetPath[1])) ||
  (assetPath.length === 2 &&
    assetPath[0] === "camera" &&
    /^[\w.-]+\.jpe?g$/.test(assetPath[1]));

const jsonError = (message: string, status: number) =>
  Response.json({ error: message }, { status });

export async function GET(
  _request: Request,
  { params }: RouteHandlerContext,
) {
  const { assetPath } = await params;

  if (!isAllowedAssetPath(assetPath)) {
    return jsonError("요청한 DriveScope 자산을 찾을 수 없습니다.", 404);
  }

  const configuredDataRoot = process.env.DRIVESCOPE_DATA_ROOT?.trim();
  if (!configuredDataRoot) {
    return jsonError("DRIVESCOPE_DATA_ROOT가 설정되지 않았습니다.", 503);
  }

  const dataRoot = path.resolve(configuredDataRoot);
  const assetFilePath = path.resolve(dataRoot, ...assetPath);
  const relativeAssetPath = path.relative(dataRoot, assetFilePath);

  if (
    relativeAssetPath.startsWith("..") ||
    path.isAbsolute(relativeAssetPath)
  ) {
    return jsonError("요청한 DriveScope 자산을 찾을 수 없습니다.", 404);
  }

  try {
    const contents = await readFile(assetFilePath);
    const isManifest = assetPath[0] === "manifest.json";
    const isCamera = assetPath[0] === "camera";

    return new Response(contents, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Length": contents.byteLength.toString(),
        "Content-Type": isManifest
          ? "application/json; charset=utf-8"
          : isCamera
            ? "image/jpeg"
            : "application/octet-stream",
      },
    });
  } catch (error) {
    const errorCode =
      error instanceof Error && "code" in error ? error.code : null;

    if (errorCode === "ENOENT") {
      return jsonError("요청한 DriveScope 자산을 찾을 수 없습니다.", 404);
    }

    console.error("DriveScope 자산을 읽지 못했습니다.", error);
    return jsonError("DriveScope 자산을 읽지 못했습니다.", 500);
  }
}
