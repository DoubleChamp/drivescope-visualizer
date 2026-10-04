# DriveScope Vercel 배포 점검

점검일: 2026-10-04. 공개 사이트는 [drivescope-visualizer.vercel.app](https://drivescope-visualizer.vercel.app/)이다. 주소 제공 후 홈·Viewer HTTP 200과 manifest API 503을 확인했다. 원격 데이터 URL·Vercel 계정 설정·빌드 로그는 아직 확인하지 않았으며 실제 센서의 배포 재생 검증은 대기 중이다.

## 확인된 상태

| 항목 | 확인 결과 |
| --- | --- |
| production build | `pnpm.cmd build` 통과. `/`, `/viewer`는 prerender, 데이터 API는 동적 Route Handler |
| 타입 검사 | `pnpm.cmd exec tsc --noEmit --incremental false` 통과 |
| manifest 규칙 | `pnpm.cmd validate:manifest` 통과. fixture의 LiDAR·Camera·ego 각 2개 검사 |
| Git | 초기 점검에서는 로컬 커밋 9개가 앞섰고, 이번 변경 시작 전에는 main·원격 main 모두 `eb1473d`로 push 완료를 확인함 |
| Next.js 설정 | `next.config.ts`는 기본 설정. 이번 점검에서 추가 설정이 필요한 렌더링 문제는 발견하지 못함 |
| 실제 데이터 입구 | NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL을 설정하면 해당 주소, 생략하면 기존 로컬 API 사용 |
| 실제 파일 제공 | API가 `DRIVESCOPE_DATA_ROOT`의 서버 로컬 파일을 readFile로 읽음 |
| 공개 manifest API | HTTP 503: DRIVESCOPE_DATA_ROOT가 설정되지 않았습니다 |
| 데모 선택 | 실제 연결 실패 시에만 가상 fallback. 사용자 모드 선택 UI는 아직 없음 |

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

### Vercel 화면에서 시작하기

사용자가 제공한 화면은 팀의 Projects 목록이다. 다음은 데이터 파일을 둘 Blob 저장소를 만드는 순서다.

1. `drivescope-visualizer` 프로젝트 카드를 연다.
2. 프로젝트의 Storage에서 Create Storage를 누르고 Blob을 선택한다.
3. Continue 뒤 access를 Public으로 선택하고 이름을 `drivescope-data`로 지정한다.
4. Create a new Blob store를 선택하고 해당 프로젝트와 연결을 확인한다. 원격 읽기 구성은 공개 파일 URL을 사용한다.

메뉴·접근 모드 기준은 [Blob 생성 안내](https://vercel.com/docs/vercel-blob/using-blob-sdk#getting-started)를 따른다. 계정 화면에서 저장소 생성은 사용자가 수행하며 이번 단계에서 파일을 업로드하지 않았다.

다음에는 scene의 manifest·camera·lidar를 경로에 맞춰 올리고 manifest의 공개 URL을 확인한다. 그 뒤 프로젝트 Settings의 환경변수에 NEXT_PUBLIC_DRIVESCOPE_MANIFEST_URL을 넣고 새 코드 push·새 deployment를 확인한다. 저장소를 생성하는 것만으로 파일이나 URL 설정이 자동 완성되지는 않는다.

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

[ViewerCanvas](../app/viewer/viewer-canvas.tsx)의 `isMockFallback = actualDataError !== null`이 가상 센서·인식·경로·이벤트 표시를 결정한다. 실제 연결이 성공하면 가상 급제동 데모를 직접 선택하는 입구가 없다.

두 데모를 모두 공개할 경우 `가상 분석 데모 / 실제 센서 로그` 선택을 별도 작은 단계로 구현한다. 사용자의 선택과 연결 실패 fallback을 구분하고 소스 전환 시 재생을 정지·0초로 이동한다. 현재 실제 모드에는 인식·Planning·급제동 이벤트가 미연결이므로 이 선택은 분석 데모를 찾는 데 필요하다.

## 실제 배포 검증 순서

1. Deployment의 commit·빌드 로그와 위 설정을 확인한다.
2. 실제 manifest 요청이 의도한 웹 저장소로 가고 응답을 브라우저에서 읽을 수 있는지 확인한다.
3. 첫 이미지와 0초 LiDAR·ego 빈 상태, 12.4초 실제 Frame·포인트·pose를 확인한다.
4. 재생·seek·이전 사진 유지·오류 복구·모바일 표시·WebGL 오류를 검사한다.
5. 모드 선택 구현 후 가상 10초 등장·11초 인식·12초 충돌·12.4초 급제동과 객체 선택도 확인한다.

[benchmark-viewer.mjs](../scripts/benchmark-viewer.mjs)는 현재 localhost만 허용하고 로컬 API manifest를 요청·가로채는 비교 도구다. 배포 주소를 이 스크립트에 넣어 실제 서비스가 검증됐다고 기록하지 않는다. 원격 지연·캐시·성능 측정은 이 로컬 기준선과 별도의 조건으로 비교한다.

## 이번 점검의 경계

이번 작은 변경은 manifest 주소를 환경별로 선택하는 입구다. production build·타입·fixture manifest 검증이 통과했다. 공개 홈·Viewer·API의 HTTP 상태도 확인했다. 계정 설정·웹 저장소 생성과 파일 업로드는 실행하지 않았고 원격 자산·CORS·브라우저 실제 재생 검증은 남아 있다. 배포 결과가 확인되기 전까지 ROADMAP의 Phase 7 항목 9는 완료로 표시하지 않는다.
