import assert from "node:assert/strict";
import { readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { parseDriveScopeManifest } = require("../app/viewer/_data/drivescope-manifest.ts");

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function readAsset(root, assetPath) {
  // 실제 경로도 검사해 scene 밖을 가리키는 심볼릭 링크를 제외한다.
  const filePath = await realpath(join(root, ...assetPath.split("/")));
  const relativePath = relative(root, filePath);
  assert(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith("../") &&
      !relativePath.startsWith("..\\"),
    `${assetPath}: scene 디렉터리 밖의 파일입니다.`,
  );
  assert((await stat(filePath)).isFile(), `${assetPath}: 파일이 아닙니다.`);
  return readFile(filePath);
}

async function prepareUpload(root) {
  const manifestBody = await readAsset(root, "manifest.json");
  const manifest = parseDriveScopeManifest(JSON.parse(manifestBody.toString("utf8")));
  assert(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(manifest.scenarioId),
    "scenarioId는 영문·숫자·밑줄·하이픈으로 된 scene 이름이어야 합니다.",
  );

  const assets = new Map();
  const references = [
    ...manifest.lidar.frames.map((frame) => ({
      path: frame.positionsFile,
      contentType: "application/octet-stream",
      expectedBytes: frame.pointCount * 3 * Float32Array.BYTES_PER_ELEMENT,
    })),
    ...manifest.camera.frames.map((frame) => ({
      path: frame.imageFile,
      contentType: "image/jpeg",
    })),
  ];

  for (const reference of references) {
    assert(
      reference.path !== "manifest.json" &&
        reference.path.split("/").every((part) => /^[a-zA-Z0-9._-]+$/.test(part)),
      "자산 경로는 영문·숫자·점·밑줄·하이픈과 /만 사용해야 합니다.",
    );
    const previous = assets.get(reference.path);
    const body = previous?.body ?? (await readAsset(root, reference.path));
    if (previous) {
      assert.equal(previous.contentType, reference.contentType, "자산 종류 충돌");
    }
    if (reference.expectedBytes !== undefined) {
      assert.equal(body.length, reference.expectedBytes, `${reference.path}: LiDAR 크기 오류`);
    } else {
      assert(
        body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff,
        `${reference.path}: JPEG 파일 시작 표시가 없습니다.`,
      );
    }
    assets.set(reference.path, { ...reference, body });
  }

  // 모든 센서 파일이 준비된 뒤 manifest를 공개한다.
  assets.set("manifest.json", { contentType: "application/json", body: manifestBody });
  return { manifest, assets };
}

async function main() {
  const args = process.argv.slice(2);
  assert(
    args.length === 0 || (args.length === 1 && args[0] === "--upload"),
    "사용법: pnpm upload:blob [--upload] (옵션 없음: 로컬 검사만)",
  );
  try {
    process.loadEnvFile(join(projectRoot, ".env.local"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const requestedRoot = process.env.DRIVESCOPE_DATA_ROOT?.trim();
  assert(requestedRoot, "DRIVESCOPE_DATA_ROOT를 설정하세요.");
  const { manifest, assets } = await prepareUpload(await realpath(requestedRoot));
  const totalBytes = [...assets.values()].reduce((total, asset) => total + asset.body.length, 0);
  console.log(`검사 완료: ${manifest.scenarioId}, ${assets.size}개 파일, ${totalBytes} bytes`);
  console.log(`LiDAR ${manifest.lidar.frames.length} / Camera ${manifest.camera.frames.length} Frame`);

  if (args.length === 0) {
    console.log("로컬 검사만 완료했습니다. 실제 업로드: pnpm upload:blob --upload");
    return;
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  assert(token, "BLOB_READ_WRITE_TOKEN을 설정하세요.");
  const { list, put } = await import("@vercel/blob");
  const prefix = `${manifest.scenarioId}/`;
  const existing = await list({ prefix, limit: 1, token });
  assert.equal(
    existing.blobs.length,
    0,
    `${prefix}에 기존 파일이 있습니다. 부분 업로드 여부를 확인하세요. 덮어쓰지 않습니다.`,
  );

  let completed = 0;
  let manifestUrl;
  for (const [assetPath, asset] of assets) {
    const pathname = `${prefix}${assetPath}`;
    const blob = await put(pathname, asset.body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: asset.contentType,
      token,
    });
    assert.equal(blob.pathname, pathname, "업로드한 경로가 요청 경로와 다릅니다.");
    completed += 1;
    if (completed % 10 === 0 || assetPath === "manifest.json") {
      console.log(`업로드 ${completed}/${assets.size}`);
    }
    if (assetPath === "manifest.json") manifestUrl = blob.url;
  }
  console.log(`NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL=${manifestUrl}`);
}

main().catch((error) => {
  // SDK나 파일 오류에도 토큰·개인 데이터 경로를 출력하지 않는다.
  let message = error.message ?? String(error);
  for (const value of [process.env.BLOB_READ_WRITE_TOKEN, process.env.DRIVESCOPE_DATA_ROOT]) {
    if (value) {
      message = message.replaceAll(value, "[비공개 값]");
      message = message.replaceAll(value.replaceAll("/", "\\"), "[비공개 값]");
    }
  }
  console.error(`업로드 중단: ${message}`);
  process.exitCode = 1;
});
