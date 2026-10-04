# DriveScope 가상·실제 데이터 성능 비교

측정일: 2026-10-03 21:53 KST

Viewer 기준 commit: `e546c3a` — 실제 데이터 오류 안내와 재시도까지 구현된 상태.

## 결과

같은 브라우저·화면 크기·탐색 순서로 가상 급제동 시나리오와 실제 nuScenes mini `scene-0061`을 각 3회 측정했다.

| 항목 | 가상 시나리오 | 실제 scene-0061 |
| --- | ---: | ---: |
| 탐색한 Frame의 포인트 수 | 15~21개 | 34,688~34,752개 |
| cache miss 로딩 시간 중앙값 | 0.3ms | 13.9ms |
| cache miss 로딩 시간 최소~최대 | 0.2~0.5ms | 8.9~32.8ms |
| cache miss 측정 개수 | 15개 | 15개 |
| 재생 중 표시 FPS 중앙값 | 75 | 75 |
| 재생 중 표시 FPS 최소~최대 | 75~75 | 75~75 |
| FPS 관측 개수 | 30개 | 30개 |
| 직전 Frame의 cache hit·로더 생략 확인 | 3/3회 | 3/3회 |

측정 중 LRU 캐시는 최대 5개를 유지했고 브라우저 런타임 예외는 0개였다. 실제 포인트 수는 manifest의 해당 Frame과 일치했다.

## 측정 환경과 순서

- Windows x64 `10.0.26100`, Node.js `24.19.0`, Next.js `16.3.3` production 서버.
- Headless Chrome `154.0.0.0`, 브라우저가 보고한 논리 프로세서 수 12개.
- WebGL renderer: ANGLE · NVIDIA GeForce GTX 1050 Ti · Direct3D11. 이번 실행은 실제 그래픽 장치를 사용했으며 다른 환경에서는 소프트웨어 렌더러가 선택될 수 있으므로 출력 값을 확인한다.
- viewport `1440×1400`, device scale factor 1. 기록된 Canvas drawing buffer는 `990×720`이었다.
- HTTP 캐시는 끄고 기존 LiDAR CPU LRU 캐시와 prefetch는 그대로 사용했다. 운영체제 파일 캐시는 초기화하지 않았다.
- 매 측정마다 Viewer를 새로 탐색해 React Hook의 CPU 캐시를 새로 시작했다. 실행 순서는 가상→실제, 실제→가상, 가상→실제였다.
- 두 시나리오에 공통으로 존재하는 `1,000 → 5,000 → 10,000 → 12,400 → 14,500ms`를 탐색했다. 각 결과가 cache miss인지 확인하고 현재 Frame의 로더 실행 시간을 읽었다.
- 마지막 Frame의 인접 Frame을 방문한 뒤 마지막 시점으로 돌아가 cache hit와 `캐시로 생략` 표시를 확인했다.
- 0초로 돌아가 2.2초 준비 시간을 둔 뒤 재생했다. 약 10초 동안 1초마다 기존 FPS 표시를 읽어 모드당 총 30개 값을 얻었다.
- 측정 스크립트는 기존 UI 값을 읽는다. 센서 데이터나 측정용 매 프레임 값을 React state에 추가하지 않는다.
- 가상 모드는 측정 브라우저의 manifest 응답만 404로 바꿔 기존 fallback을 사용한다. 서버 설정과 실제 데이터 파일은 수정하지 않는다.

## 로딩 시간의 의미

`useLidarFrameCache`가 새 `source.loadFrame()`을 호출하기 직전의 `performance.now()`와 Promise가 완료된 시각의 차이다.

```ts
const loadStartedAt = performance.now();
const load = source.loadFrame(timestampMs).then((frame) => ({
  frame,
  loadDurationMs: performance.now() - loadStartedAt,
}));
```

위 코드는 측정 구간만 보여주는 발췌이며 실제 Hook에서는 캐시 저장과 진행 중 요청 Map 정리도 수행한다. 현재 Frame을 위해 새로 실행된 cache miss 결과만 이 비교에 포함했다. 주변 prefetch 측정값과 cache hit는 로딩 시간 통계에 넣지 않았다. UI가 소수점 둘째 자리까지 표시한 값을 수집했으므로 그보다 세밀한 값을 해석하지 않는다.

가상 로더는 이미 메모리에 있는 원본 검색과 작은 `Float32Array` 복사를 포함한다. 실제 로더는 HTTP 요청, 서버 파일 읽기, 응답 수신, 바이너리 크기 검사와 `Float32Array` 해석을 포함한다. 따라서 두 값은 현재 데이터 소스가 화면에 제공되는 비용의 비교이며, 동일한 크기의 배열 파싱 속도 비교가 아니다.

Promise가 끝날 때까지의 경과 시간에는 비동기 대기도 들어간다. 실제 중앙값 13.9ms를 메인 스레드가 13.9ms 동안 멈췄다는 뜻으로 해석하지 않는다. 이 구간에는 React 화면 반영, Three.js Buffer 복사·GPU 업로드, 이미지 다운로드·디코딩·표시가 포함되지 않는다.

## FPS의 의미와 한계

FPS는 Three.js Hook이 약 1초 동안 호출한 `renderer.render()` 횟수를 경과 시간으로 나눈 뒤 반올림한 값이다. 이번 스크립트는 그 기존 UI 값을 1초 간격으로 관측했으므로 서로 독립적인 GPU 성능 표본이나 정확한 프레임별 소요 시간을 측정한 것은 아니다.

이번 실행에서는 두 모드 모두 표시 FPS가 75에 머물렀다. 브라우저 rAF 실행 주기에 제한됐을 가능성이 있으며, 이 값만으로 두 모드의 CPU·GPU 비용이나 남은 처리 여유가 같다고 결론낼 수 없다. 현재 환경·약 10초 재생 구간에서 FPS 저하를 관찰하지 않았다는 결과로 사용한다.

가상 모드에는 가상 객체·경로·SVG 사진이 있고 실제 모드에는 실제 점군·ego pose·JPEG 사진이 있다. 이번 비교는 각 모드의 현재 Viewer 전체 부하를 측정했으며, 포인트 수만 바꾼 실험이나 Buffer 재사용 전후 비교는 아니다.

3회·15개 cache miss의 초기 기준선이다. 장시간 메모리 변화, 원격 네트워크, 다른 장치, 정확한 CPU 정지·GPU 시간과 Worker 효과는 검증하지 않았다. 이번 수치로 Worker 도입 여부를 결정하지 않으며, 배포 후 계획한 파일 읽기·파싱 시간 분리와 메인 스레드 정지 측정에서 다시 판단한다.

## 개별 cache miss 기록

열의 순서는 목표 재생 시각이다. 단위는 ms다.

| 회차·모드 | 1.0초 | 5.0초 | 10.0초 | 12.4초 | 14.5초 | 회차 중앙값 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · 가상 | 0.4 | 0.5 | 0.4 | 0.3 | 0.3 | 0.4 |
| 1 · 실제 | 17.2 | 15.5 | 17.1 | 15.4 | 13.9 | 15.5 |
| 2 · 실제 | 15.6 | 11.1 | 9.7 | 12.1 | 10.9 | 11.1 |
| 2 · 가상 | 0.3 | 0.3 | 0.4 | 0.3 | 0.5 | 0.3 |
| 3 · 가상 | 0.3 | 0.2 | 0.5 | 0.2 | 0.5 | 0.3 |
| 3 · 실제 | 19.4 | 13.4 | 8.9 | 32.8 | 12.7 | 13.4 |

| 목표 재생 시각 | 가상 포인트 수 | 실제 포인트 수 |
| --- | ---: | ---: |
| 1.0초 | 15 | 34,720 |
| 5.0초 | 15 | 34,688 |
| 10.0초 | 21 | 34,688 |
| 12.4초 | 21 | 34,752 |
| 14.5초 | 21 | 34,752 |

## 다시 실행하기

v3 산출물과 `.env.local`의 데이터 연결을 준비한다. 첫 번째 터미널에서:

```powershell
pnpm.cmd validate:manifest
pnpm.cmd build
pnpm.cmd start --port 3100
```

다른 터미널에서:

```powershell
$env:DRIVESCOPE_BENCHMARK_URL = 'http://localhost:3100'
pnpm.cmd benchmark:viewer
```

기본 URL은 `http://localhost:3000`이다. Chrome이 기본 설치 위치에 없으면 `DRIVESCOPE_BENCHMARK_CHROME`에 설치된 Chromium 계열 브라우저 실행 파일을 지정한다.

스크립트는 콘솔에 회차별 결과와 요약을 출력하고 `node_modules/.cache/drivescope-benchmark/latest.json`에 개별 FPS·로딩 시간과 실행 환경을 저장한다. 임시 브라우저 프로필도 같은 Git 제외 캐시에 남는다. 공유 기준선은 이 문서이며 두 컴퓨터의 개인 데이터 경로나 브라우저 프로필을 Git에 넣지 않는다.

## 후속 계측: 로더 구간과 요청 주체

측정일: 2026-10-04 23:25 KST. 작업 시작 commit은 `bba2d88`이며 그 위에 아래 구간 계측을 추가한 production build를 사용했다. 앞의 2026-10-03 기준선과 홈의 **13.9ms는 그대로 유지**한다. 아래 값은 새 계측 실행의 관측이며 최적화 전후 향상률이 아니다. [원본 JSON](./benchmarks/lidar-load-timings-2026-10-04.json)에 실행 환경·개별 요청·구간·FPS를 보관한다.

### 측정 위치

[실제 로더](../app/viewer/_data/load-drivescope-data-source.ts)에서 네 시각을 기록한다.

```ts
const requestStartedAt = performance.now();
const response = await fetch(url, { cache: "no-store" });
const headersReceivedAt = performance.now();
const buffer = await response.arrayBuffer();
const bodyReadAt = performance.now();
// 파일 크기 검사 → 좌표 배열 해석
const positionsPreparedAt = performance.now();
```

위 코드는 측정 위치를 설명하는 발췌다. 실제 구현은 HTTP 실패와 크기 불일치를 검사한다. 로더는 `{ frame, timings }`를 반환하고 [캐시 Hook](../app/viewer/_hooks/use-lidar-frame-cache.ts)은 Frame만 캐시에 넣으며 기존 전체 시간도 기록한다.

| 구간 | 계산 | 포함하는 비용 |
| --- | --- | --- |
| 응답 헤더까지 | headersReceivedAt − requestStartedAt | 서버 처리·네트워크·브라우저 대기, fetch Promise 재개 |
| 응답 본문 읽기 | bodyReadAt − headersReceivedAt | HTTP 상태 확인, 남은 다운로드·ArrayBuffer 준비·Promise 재개 |
| 좌표 배열 준비 | positionsPreparedAt − bodyReadAt | 파일 크기 검사와 endian별 좌표 해석 |
| 전체 로딩 | Hook 로더 시작부터 완료 callback의 캐시 저장 뒤까지 | 위 구간과 metadata/URL 준비·캐시 저장·Promise 처리 등 |

브라우저 계측이므로 **서버 디스크 읽기만의 시간은 분리하지 않는다**. 응답 헤더 완료 뒤에도 다운로드가 진행될 수 있다. 이 모든 지표는 GPU Buffer 복사·업로드·GPU 실행·React 표시·JPEG 처리 시간을 포함하지 않는다. 비동기 구간의 경과 시간을 메인 스레드 정지 시간으로 해석하지 않는다.

### 현재 요청과 prefetch

새 HTTP 로딩을 만드는 순간 `requestKind: current | prefetch`와 `startedAtMs`를 기록한다. 현재 선택이 진행 중인 prefetch를 공유하면 새 요청을 만들지 않고 **최초 prefetch의 종류·시작 시각**을 유지한다. 따라서 공유 결과의 전체 시간은 사용자가 해당 Frame을 선택한 뒤 기다린 시간과 다를 수 있다. 새 현재 요청의 통계에는 `requestKind === current`만 포함한다.

cache hit는 로더 호출을 생략하고 현재 세부 값을 지운다. prefetch 완료는 현재 성공 측정값을 바꾸지 않는다. 실패한 로딩의 구간은 성공 표본에 포함하지 않는다. UI는 기본 접힌 [세부 표시](../app/viewer/_components/lidar-load-details.tsx)에 현재 성공 결과 하나와 마지막 완료 주변 묶음 최대 두 개만 보관한다. 전체 이력을 React state에 누적하지 않는다.

### 이번 실행 결과

Windows·Node 24.19.0·Chrome 154·GTX 1050 Ti·1440×1400·HTTP 캐시 비활성·LRU 최대 5개는 기존과 같은 조건이다. 가상/실제 각 3회와 다섯 탐색 시각도 유지했다. 기능 검증 Chrome을 종료한 뒤 벤치마크를 단독 실행했다. 실제는 각 현재 요청 뒤 양옆 prefetch의 완료도 확인하고 별도로 수집한다. 이 기다림은 다음 seek 간격을 바꾸므로 이전 기준선과 엄밀한 전후 비교로 사용하지 않는다. OS 파일 캐시는 초기화하지 않았다.

| 구간 / ms | 현재 요청 15개 중앙값 | 최소~최대 | prefetch 30개 중앙값 | 최소~최대 |
| --- | ---: | ---: | ---: | ---: |
| 응답 헤더까지 | 11.20 | 9.30~65.80 | 11.75 | 8.20~17.00 |
| 응답 본문 읽기 | 2.50 | 1.40~16.60 | 1.70 | 1.10~17.10 |
| 좌표 배열 준비 | 0.00 | 0.00~0.10 | 0.00 | 0.00~0.10 |
| 전체 로딩 | 15.00 | 12.40~69.50 | 14.00 | 9.70~29.20 |

각 행의 중앙값은 별개 표본 정렬 결과이므로 중앙값들을 더해 전체 중앙값과 비교하지 않는다. 원본 JS number는 JSON에 보존하고 표·UI는 소수점 둘째 자리로 표시한다. 브라우저 clock 해상도·반올림에 따라 `0.00ms`가 나오며 실제 비용이 없다는 뜻은 아니다. 현재 little-endian 경로는 좌표를 순회해 변환하거나 복사하지 않고 Float32Array view를 만든다.

이번 표본에서는 좌표 배열 준비보다 응답 헤더·본문 구간이 컸다. 서버·네트워크·브라우저 중 어느 것이 병목인지는 이 값만으로 분리할 수 없다. 평균·P95·메인 스레드 정지·Worker 효과는 이번 단계에서 측정하지 않았다. 가상 로더의 HTTP 구간은 `null`이고 전체 로딩 중앙값은 0.40ms였다. 가상/실제 각 30개 FPS는 75, 각 cache hit 확인은 3/3회였으며 런타임 예외는 0개였다.

### 검증과 재실행

```powershell
pnpm.cmd verify:lidar-timings
pnpm.cmd validate:manifest
pnpm.cmd build
# 위의 production 서버·benchmark:viewer 실행 명령은 그대로 사용한다.
```

[로더 검증 스크립트](../scripts/verify-lidar-load-timings.mjs)는 실제 TS를 메모리에서 실행하고 가짜 clock·fetch로 헤더 40ms와 본문 70ms를 따로 준다. 구간 분리·좌표 보존, 없는 timestamp의 요청 생략, HTTP 실패, 잘린 바이너리의 4개 검사를 통과했다. 이 합성 시간은 위 실제 표본에 포함하지 않는다.

격리 Chrome의 기능 검사 6개 묶음에서는 현재/prefetch 분리·현재 값 유지, 1440/390/320px 표시, cache hit의 과거 값 제거, 진행 중 prefetch 공유 시 HTTP 한 번·최초 종류 유지, HTTP 실패·재시도, 모드 전환 뒤 늦은 완료 차단을 확인했다. 브라우저 오류는 0개였으며 실제 모바일 기기 검증으로 확대하지 않는다. 해당 보조 도구·프로필·스크린샷은 Git 제외 캐시에 보관한다.
