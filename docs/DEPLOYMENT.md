# DriveScope Vercel 배포 점검

점검일: 2026-10-04. 공개 사이트는 [drivescope-visualizer.vercel.app](https://drivescope-visualizer.vercel.app/)이다. Public Blob에 실제 scene 파일 79개를 올려 원본 일치·CORS를 확인했고, 사용자의 URL 환경변수 설정·push 뒤 공개 Viewer의 실제 센서 재생·탐색·오류 복구·모바일을 검증했다. Phase 7 배포 항목 9를 완료로 기록한다.

## 확인된 상태

| 항목 | 확인 결과 |
| --- | --- |
| production build | `pnpm.cmd build` 통과. `/`, `/viewer`는 prerender, 데이터 API는 동적 Route Handler |
| 타입 검사 | `pnpm.cmd exec tsc --noEmit --incremental false` 통과 |
| manifest 규칙 | `pnpm.cmd validate:manifest` 통과. fixture의 LiDAR·Camera·ego 각 2개 검사 |
| Git | 배포 검증 시작 시 main·origin/main·원격 main이 `882845f`로 같음. deployment 화면의 정확한 commit 표시·빌드 로그는 미조회 |
| Next.js 설정 | `next.config.ts`는 기본 설정. 이번 점검에서 추가 설정이 필요한 렌더링 문제는 발견하지 못함 |
| 실제 데이터 입구 | NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL을 설정하면 해당 주소, 생략하면 기존 로컬 API 사용 |
| 실제 파일 제공 | API가 `DRIVESCOPE_DATA_ROOT`의 서버 로컬 파일을 readFile로 읽음 |
| 공개 manifest API | HTTP 503: DRIVESCOPE_DATA_ROOT가 설정되지 않았습니다 |
| 공개 Blob 자산 | scene-0061의 79개·21,976,548바이트 업로드 완료. 모두 HTTP 200·MIME·SHA-256 일치 |
| 원격 읽기 | 모든 파일의 CORS `*`, 배포 origin의 Chrome에서 manifest·bin fetch와 JPEG decode 성공 |
| 배포 Viewer | 실제 모드·공개 Blob 직접 요청·재생·탐색·사진 유지·오류 복구·모바일 에뮬레이션 통과 |
| 데모 선택 | 실제/가상 선택·전환 초기화 로컬 검증 완료. 선택 UI 공개 반영은 사용자 push 이후 확인 |

Git 연동 배포라면 로컬 commit만으로 Vercel에 코드가 반영되지 않는다. 사용자가 GitHub Desktop에서 push한 뒤 Vercel의 성공한 deployment가 해당 commit을 가리키는지 확인한다. CLI로 별도 배포했는지는 이번 점검에서 확인하지 않았다.

## Vercel에서 확인할 설정

아래는 현재 프로젝트에 맞는 기준값이다. 대시보드의 실제 설정을 조회한 결과는 아니다.

| 위치·설정 | 기준값·확인 방법 |
| --- | --- |
| Git 연결 | 이 저장소 연결과 production branch `main` 확인 |
| Framework Preset | Next.js |
| Root Directory | package.json·app이 있는 저장소 루트 |
| Build Command | Next.js 기본 build 또는 `pnpm run build` |
| Output Directory | Next.js 자동 설정 유지 |
| Node.js Version | 로컬 검증 환경과 같은 24.x 권장 |
| 패키지 매니저 | Build Logs에서 실제 pnpm 버전 확인. package.json의 지정 값은 `pnpm@11.24.0` |
| 환경변수 적용 범위 | Production·Preview에서 각각 사용할 manifest URL 설정 후 새 build |

Framework·Root·Build·Output은 [Vercel 빌드 설정](https://vercel.com/docs/builds/configure-a-build), Node 24.x 지원과 설정은 [Node.js 버전 문서](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)를 따른다.

현재 lockfileVersion은 9.0이다. Vercel 문서는 이 lockfile의 기본 pnpm 선택을 9 또는 10으로 설명한다. packageManager에 11.24.0을 적었다고 실제 빌드가 같은 버전을 사용하는 것으로 단정하지 않는다. [패키지 매니저 문서](https://vercel.com/docs/package-managers)

버전을 packageManager 기준으로 선택하려면 Vercel이 안내하는 Corepack 방식에서 `ENABLE_EXPERIMENTAL_COREPACK=1`을 설정하고 다음 빌드의 설치 로그로 확인한다. Install Command가 임의 override되어 있는지도 함께 확인한다. [Corepack 설정](https://vercel.com/docs/builds/configure-a-build#corepack)

## 실제 데이터 연결에 필요한 변경

### 브라우저의 manifest 입구

[load-drivescope-data-source.ts](../app/viewer/_data/load-drivescope-data-source.ts)에 공개 환경변수로 manifest 입구를 선택하는 변경을 적용했다. URL을 설정하지 않은 기존 로컬 사용은 같은 API를 요청한다.

```ts
export const DRIVE_SCOPE_MANIFEST_URL =
  process.env.NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL?.trim() ||
  "/api/drivescope-data/manifest.json";
```

로컬에서는 URL을 생략해 기존 API를 사용하고 Vercel에는 웹 저장소의 HTTPS manifest URL을 넣는다. 현재 `DRIVESCOPE_DATA_ROOT`는 서버 로컬 디렉터리 설정이므로 개발자 PC 경로를 Vercel에 넣는 것으로 실제 파일이 제공되지는 않는다.

NEXT_PUBLIC 값은 Next.js build에서 브라우저 코드에 들어간다. 대시보드 값을 변경한 뒤 새 deployment를 만들어야 한다. 이 변수에는 공개 읽기 주소를 사용한다. [Next.js 환경변수 문서](https://nextjs.org/docs/app/guides/environment-variables)

### 생성한 저장소와 업로드 도구

사용자가 프로젝트 Storage의 Create Database에서 Blob·Public을 선택해 `drivescope-visualizer-blob` 저장소를 생성했다. 화면에서는 이름이 자동으로 지정됐고 해당 프로젝트와 연결된 상태를 확인했다. 생성·접근 모드의 기준은 [Blob 생성 안내](https://vercel.com/docs/vercel-blob/using-blob-sdk#getting-started)를 따른다.

사용자가 새 발급 토큰을 개인 `.env.local`의 BLOB_READ_WRITE_TOKEN에 설정했다. 업로드 도구는 같은 파일의 DRIVESCOPE_DATA_ROOT에서 scene을 읽는다. 토큰은 Node CLI의 SDK 인증에만 사용하고 브라우저 공개 환경변수나 Git에 넣지 않는다.

[upload-drivescope-data.mjs](../scripts/upload-drivescope-data.mjs)는 Node.js에서 실행하는 오프라인 배포 도구다. 브라우저 재생 중에는 실행하지 않는다. `@vercel/blob`은 이 도구의 개발 의존성이다.

```powershell
# 로컬 검사만 실행: 네트워크 요청·업로드 없음
pnpm.cmd upload:blob

# 검사 통과 후 Public Blob에 실제 업로드
pnpm.cmd upload:blob --upload
```

스크립트는 v3 parser로 manifest를 읽고 참조 파일만 수집한다. 실제 경로가 scene 안에 있는지, 파일이 존재하는지, LiDAR 크기가 pointCount × 12인지와 JPEG 시작 표시를 검사한다. 모든 파일 내용을 준비한 뒤 SDK를 호출한다. JPEG 시작 표시 검사는 이미지 전체 디코딩 검사가 아니며 원격 첫 사진은 Chrome decode로 별도 확인했다.

핵심 업로드 코드는 다음과 같다. scene prefix 아래 상대 경로를 유지해 기존 manifest를 수정 없이 사용한다. SDK 옵션과 응답은 [공식 문서](https://vercel.com/docs/vercel-blob/using-blob-sdk#put)를 따른다.

```js
const blob = await put(`${prefix}${assetPath}`, asset.body, {
  access: "public",
  addRandomSuffix: false,
  allowOverwrite: false,
  contentType: asset.contentType,
  token,
});
```

사진·LiDAR를 순서대로 올린 뒤 manifest를 마지막에 공개한다. 같은 scene prefix에 기존 파일이 있으면 업로드 전에 중단한다. 중간 실패 후에는 일부 파일이 남을 수 있으므로 목록·내용을 확인한 뒤 재시도 범위를 정한다. 이 도구는 기존 파일을 덮어쓰거나 자동으로 삭제하지 않는다.

### 확보한 URL과 다음 환경 설정

공개 manifest: [scene-0061/manifest.json](https://yvt07zz1kuvzdwlw.public.blob.vercel-storage.com/scene-0061/manifest.json)

Vercel의 `drivescope-visualizer` 프로젝트 → Environment Variables에 다음 값을 **Config** 타입으로 Production·Preview 범위에 추가한다. 사용자가 이 설정을 마쳤다고 확인했고 공개 Production Viewer의 적용을 검증했다. Preview 배포는 이번에 열어 확인하지 않았다.

```dotenv
NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL=https://yvt07zz1kuvzdwlw.public.blob.vercel-storage.com/scene-0061/manifest.json
```

공개 prefix가 있는 변수에 Secret을 선택하면 사용자 화면에서 등록 오류가 발생했다. 공개 manifest 주소는 Config로 등록한다. BLOB_READ_WRITE_TOKEN은 Secret이며 BLOB_STORE_ID·BLOB_WEBHOOK_PUBLIC_KEY는 연결된 저장소의 Config 값으로 유지한다. Config는 비밀이 아닌 설정, Secret은 인증 정보에 쓰는 현재 [Vercel 타입 안내](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types)를 따른다.

사용자의 GitHub Desktop push 후 원격 main `882845f` 일치를 확인했고 배포 Viewer가 위 URL을 실제 요청했다. 환경변수는 새 build에 포함되어야 하며 기존 deployment를 단순히 새로고침하는 것으로 값이 바뀌지는 않는다. 계정의 정확한 deployment commit 표시·설치 로그는 별도 확인 항목이다. 방화벽 설정은 사용자의 요청으로 뒤로 미뤘다.

### 웹 저장소의 파일과 응답

변환된 scene의 manifest와 참조 파일을 다음 상대 경로 구조로 함께 제공한다.

```text
scene-0061/
  manifest.json
  camera/*.jpg
  lidar/*.bin
```

로더는 manifest 응답 URL을 기준으로 `new URL(frame.imageFile, manifestBaseUrl)`과 `new URL(frame.positionsFile, manifestBaseUrl)`을 계산한다. 업로드 경로나 파일명이 달라지면 해당 manifest 경로도 맞아야 한다. 임의 suffix로 이름을 바꿀 때의 동작은 [Blob SDK 문서](https://vercel.com/docs/vercel-blob/using-blob-sdk)를 참고한다.

| 확인 항목 | 성공 기준 |
| --- | --- |
| 공개 읽기·HTTPS | 방문자 브라우저에서 manifest·JPEG·bin을 읽을 수 있음 |
| 상대 경로 | manifest가 참조한 모든 자산 URL이 200 응답 |
| v3 계약 | 현재 parser가 schema·timestamp·좌표·ego pose를 통과시킴 |
| bin 무결성 | pointCount × 3 × 4바이트와 응답 크기가 같음 |
| 응답 형식 | JSON·image/jpeg·application/octet-stream으로 파일 제공 |
| CORS | 다른 origin의 manifest·bin 응답을 브라우저 fetch에서 읽을 수 있음 |

Vercel Blob을 선택하면 공개 저장소의 URL을 브라우저가 직접 읽는 구성이 가능하다. Private Blob은 인증이 필요한 다른 연결 경계이므로 위 직접 URL 구성은 공개 읽기를 전제로 한다. [Blob 접근 방식](https://vercel.com/docs/vercel-blob)

CORS는 데이터를 제공하는 웹 저장소의 응답 정책이다. 앱과 저장소의 origin이 다르면 주소창에서 파일이 열려도 브라우저 fetch로 읽을 수 있는지는 별도로 검증한다. [MDN CORS 문서](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

현재 [CameraPanel](../app/viewer/_components/camera-panel.tsx)은 일반 img와 브라우저 decode를 사용한다. next/image의 remotePatterns 설정 대상은 현재 없다. LiDAR CPU 캐시·이미지 버퍼·Three.js 렌더링은 이 파일 제공 경계 뒤에서 재사용한다.

## 두 데모를 보여주는 방법

[ViewerSourceSelector](../app/viewer/_components/viewer-source-selector.tsx)에서 **실제 센서 로그 / 가상 급제동 데모**를 고른다. [ViewerCanvas](../app/viewer/viewer-canvas.tsx)는 기본 실제 선택을 보관하고 `ViewerSession key={mode}`로 전환 때 재생·선택·센서·캐시·Three.js를 초기화한다. 가상 선택은 실제 manifest 요청을 생략한다.

`isMockData = mode === "mock" || actualDataError !== null`이 가상 센서·인식·경로·이벤트 표시를 결정한다. 실제 연결 실패 시 선택은 실제로 유지하고 오류와 가상 fallback·재연결을 제공한다. 수동 가상 선택은 연결 오류를 표시하지 않는다. 현재 실제 모드에는 인식·Planning·급제동 이벤트가 미연결이므로 선택 UI로 가상 분석 데모에도 접근한다.

선택 UI는 로컬 production build와 브라우저 검증을 마쳤다. GitHub Desktop에서 사용자 push·Vercel 새 배포 뒤 아래 공개 검증을 이어간다. 이전 공개 실제 센서 검증을 새 UI의 배포 완료로 기록하지 않는다.

## 실제 배포 검증 순서

1. Deployment의 commit·빌드 로그와 위 설정을 확인한다.
2. 실제 manifest 요청이 의도한 웹 저장소로 가고 응답을 브라우저에서 읽을 수 있는지 확인한다.
3. 첫 이미지와 0초 LiDAR·ego 빈 상태, 12.4초 실제 Frame·포인트·pose를 확인한다.
4. 재생·seek·이전 사진 유지·오류 복구·모바일 표시·WebGL 오류를 검사한다.
5. 상단 선택 UI로 가상 10초 등장·11초 인식·12초 충돌·12.4초 급제동과 객체 선택을 확인한다. 재생 중 양방향 전환에서 0초·정지·선택 해제와 실제/가상 사진 구분도 확인한다.

[benchmark-viewer.mjs](../scripts/benchmark-viewer.mjs)는 현재 localhost만 허용하고 로컬 API manifest를 요청·가로채는 비교 도구다. 배포 주소를 이 스크립트에 넣어 실제 서비스가 검증됐다고 기록하지 않는다. 원격 지연·캐시·성능 측정은 이 로컬 기준선과 별도의 조건으로 비교한다.

## 공개 Viewer 검증 결과

`node node_modules/.cache/drivescope-upload-check/check-live-viewer.mjs`로 격리된 Headless Chrome에서 실제 배포 주소를 검사했다. 공개 manifest·자산만 사용하며 PC 데이터 루트·업로드 토큰을 읽지 않는다. 요청 캐시를 끄고 1440×1100 desktop·390×844 mobile 에뮬레이션에서 실행했다. 보고서와 스크린샷은 같은 Git 제외 캐시에 보관한다.

| 항목 | 결과 |
| --- | --- |
| 주소·소스 | 홈·Viewer HTTP 200, 실제 scene-0061·19.185초·각 센서 39개 |
| 데이터 요청 | 공개 Blob manifest·자산 직접 요청. 기존 로컬 API 요청 없음 |
| 0초 | 첫 Camera 표시, 첫 LiDAR·ego의 35ms 전이므로 해당 Frame 없음 |
| 12.4초 | Camera 12,050ms / LiDAR·ego 12,085ms / 34,752포인트 |
| 차량 pose | X -16.81m / Y 1.07m / Z -66.49m / yaw 71.5°, manifest와 일치 |
| 재생·탐색 | 2초 재생에서 12.4→14.4초 진행·정지 뒤 유지·19초 탐색 통과 |
| 이미지 준비 | 650ms 요청 보류 중 기존 사진·촬영 시각·지연 안내 유지, 완료 후 교체 |
| 빠른 seek | 보류된 이전 이미지 완료가 새 선택을 덮어쓰지 않음 |
| 빈 이미지·DOM 교체 | rAF 표본 352개에서 모두 0회 |
| 오류 복구 | 검증 브라우저의 JPEG·LiDAR 실패 후 retry, manifest 503의 가상 fallback 후 실제 재연결 통과 |
| 모바일·WebGL | 가로 overflow 없음, GTX 1050 Ti ANGLE Direct3D11, runtime exception 0 |

실제 서버·파일에 오류를 만들지 않았다. 실패·지연은 이 검증 브라우저의 요청에만 적용했다. 기존 API는 여전히 DRIVESCOPE_DATA_ROOT 미설정 503이지만 실제 Viewer가 사용한 공개 Blob 요청에는 영향을 주지 않았다. 앱·파일 제공 경계를 분리한 결과다.

선택 UI 추가 전 공개 Viewer에서 9개 검사 묶음이 통과했으며 desktop·mobile 스크린샷에서 점군·차량·전방 사진을 확인했다. 에뮬레이션과 한 번의 표본을 모든 모바일 장치·장시간 안정성·원격 성능 보장으로 확대하지 않는다.

## 점검 범위와 남은 작업

앞선 업로드 단계에서는 파일 79개·21,976,548바이트의 HTTP 200·MIME·원본 SHA-256 일치와 LiDAR 크기를 확인했다. Chrome에서 배포 origin으로 manifest·첫 bin을 fetch하고 첫 JPEG를 decode해 34,688포인트·416,256바이트·1600×900 이미지를 읽었다. 이번에는 배포 앱의 실제 표시·재생까지 검증했다.

업로드 사전 검사 4개·fixture manifest는 앞선 변경에서 통과했다. 이후 데모 선택 UI를 추가하고 `pnpm.cmd build`와 로컬 production Chrome 검사 10개 묶음을 통과했다. 양방향 전환·비동기 완료 차단·오류 fallback·retry·객체 선택 초기화·키보드·320/390px 화면을 확인했다. 이전 WebGL context의 draw 중지와 Buffer·Program 삭제도 관찰했다. 자세한 명령·결과는 [PROGRESS](./PROGRESS.md)에 기록한다.

선택 UI의 공개 반영, 계정 deployment 상세·Preview·실제 모바일 기기·1분 영상·사용자가 미룬 방화벽은 남은 확인 또는 별도 작업이다.
