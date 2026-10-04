# DriveScope 1분 데모 영상과 촬영 대본

기준: 2026-10-04의 [공개 Viewer](https://drivescope-visualizer.vercel.app/viewer). 실제/가상 선택 UI가 반영된 화면을 사용한다. 사용자가 선택한 자막 방식으로 녹화·편집을 완료했다.

결과물: [60초 MP4](../public/demo/drivescope-demo.mp4) · [한국어 자막 SRT](../public/demo/drivescope-demo.ko.srt) · [자막 스타일 ASS](../public/demo/drivescope-demo.ko.ass) · [포스터](../public/demo/drivescope-demo-poster.jpg). 아래 내레이션 초안의 의미를 13개 자막으로 나누었으며 음성 트랙은 포함하지 않는다.

## 촬영 전에 준비할 화면

1. 공개 Viewer를 데스크톱 브라우저에서 연다. 가로 16:9 캡처 영역을 준비하고, **3D 장면·전방 카메라·타임라인**이 함께 보이도록 맞춘다. 장면을 설명할 때는 3D LiDAR 장면 패널 상단으로 스크롤한다. 리허설 기준 viewport는 1920×1080이다.
2. **실제 센서 로그**를 선택하고 첫 사진과 연결 완료를 기다린다. 0초에는 첫 LiDAR·ego Frame보다 이르므로 **1.0초**로 이동해 점군과 차량 표시를 준비한다.
3. 가상 모드의 **10.0 → 11.0 → 12.0 → 12.4초**를 한 번씩 방문한다. 이미지와 포인트가 준비된 뒤 촬영하며, 내레이션과 화면 녹화는 따로 진행해도 된다.
4. 타임라인을 드래그해 목표 근처로 이동한다. 타임라인에 focus가 있을 때 방향키 한 번으로 **0.1초**씩 맞춘다. 탐색하면 재생이 정지한다. 급제동 마커는 위치 안내이며, 이동은 타임라인으로 한다.
5. 실제/가상 모드를 바꾸면 **0초·정지·선택 해제**로 시작한다. 모드 변경 후 각 장면의 시각을 다시 맞춘다.

60초는 **편집된 영상의 길이**다. 아래의 영상 시각과 Viewer 재생 시각을 구분한다. 센서 로딩을 기다리거나 조작을 수정한 구간은 편집하고, 각 변화 뒤 1~2초 화면을 유지한다. 내레이션 길이는 실제 낭독 후 조정한다.

## 60초 구성과 내레이션

| 영상 구간 | 화면과 조작 | 내레이션 초안 |
| --- | --- | --- |
| 0~5초 | Viewer 상단 제목·실제/가상 선택을 보여준다. | “DriveScope는 센서 로그를 같은 시간축에서 분석하는 도구입니다.” |
| 5~18초 | 실제 모드 1.0초에서 재생해 점군·사진·차량 이동을 보여준다. 정지하고 12.4초로 탐색한다. | “실제 주행 로그의 라이다와 전방 사진, 차량 위치를 함께 재생합니다. 약 삼만 오천 개 포인트를 표시하고, 타임라인으로 원하는 시점을 찾습니다.” |
| 18~38초 | 상단에서 가상을 선택하고 장면 패널로 돌아온다. 10.0 → 11.0초에서 보행자 박스를 클릭한다. 선택 패널이 커지면 스크롤 구도를 다시 맞춘다. 12.0 → 12.4초는 편집에서 보행자·차량·경로 주변을 확대해 비교한다. | “가상 데모에서는 십 초에 보행자가 등장하고, 십일 초에 인식됩니다. 박스를 선택하면 객체 정보를 확인할 수 있습니다. 십이 초의 예상 충돌 구간은 십이 점 사 초 급제동 후 사라집니다.” |
| 38~48초 | 가상 12.4초에서 타임라인·Camera 12.0초·Frame 동기화의 차이를 확대한다. | “센서는 수집 주기가 다릅니다. 재생 시각이 십이 점 사 초여도 카메라는 그 이전의 최신 사진인 십이 초를 보여줍니다.” |
| 48~57초 | 가상 12.5초를 방문하고 12.4초로 돌아와 `hit · 재사용`과 `캐시로 생략`을 확대한다. 마지막 3초는 13.0 → 12.4초로 사진을 바꾸며 디코딩 후 교체를 설명한다. | “라이다는 캐시와 재사용 버퍼로 처리하고, 사진은 디코딩이 끝난 뒤 교체합니다.” |
| 57~60초 | 공개 Viewer와 저장소 링크를 끝 화면에 표시한다. | “공개 데모와 코드는 여기서 확인하세요.” |

## 가상 장면에서 확인할 변화

| Viewer 시각 | Camera·LiDAR | 인식·경로와 조작 |
| --- | --- | --- |
| 10.0초 | 보행자 사진, 15 → 21포인트 | 보행자는 센서에 등장했지만 인식 박스는 아직 없다. |
| 11.0초 | 보행자 사진, 21포인트 | 인식 박스가 나타난다. 박스를 클릭하면 `pedestrian-1`·신뢰도 90%가 표시된다. |
| 12.0초 | 12.0초 사진, 21포인트 | 노란 예상 경로에서 빨간 충돌 예상 구간을 확인한다. 선택 정보의 신뢰도는 96%로 갱신된다. |
| 12.4초 | 12.0초 사진을 유지한다. Camera·LiDAR·Object Detection의 시각 차이는 -400ms다. | 급제동 마커 위치다. 새 계획의 경로가 짧아지고 빨간 충돌 구간이 사라진다. |
| 12.5 → 12.4초 | 근처 Frame을 방문한 뒤 이미 캐시된 12.0초 LiDAR로 돌아온다. | `hit · 재사용`·`캐시로 생략`을 확인한다. |

12.4초에는 **이벤트·예상 경로**가 바뀐다. 가상 Camera의 수집 주기는 1초이므로 사진은 12.0초이며, 급제동 이후 사진은 13.0초 Frame에서 보인다. 빨간 구간은 가상 차량·보행자 footprint와 계획 경로의 겹침이다. 실제 사고를 예측한 AI 모델의 출력으로 설명하지 않는다.

## 설명과 연결되는 코드

| 영상에서 설명할 원리 | 시작 코드 | 설명할 내용 |
| --- | --- | --- |
| 모드 전환과 초기화 | [viewer-canvas.tsx](../app/viewer/viewer-canvas.tsx) | 선택 `mode`가 `ViewerSession`의 key를 바꾸면 이전 세션 cleanup 후 새 시계·선택·캐시로 시작한다. 일반 state 변경은 같은 key의 세션을 유지한다. |
| 센서 시간 동기화 | [find-latest-frame-at-or-before.ts](../app/viewer/_data/find-latest-frame-at-or-before.ts) | 모든 센서가 같은 재생 시각을 입력받고 각각 그 시각 이하의 최신 Frame을 선택한다. |
| CPU 캐시 | [use-lidar-frame-cache.ts](../app/viewer/_hooks/use-lidar-frame-cache.ts) | 현재 Frame과 주변 Frame을 준비하고, 완료된 Frame은 최대 5개 보관한다. cache hit는 해당 로더 호출을 생략한다. |
| GPU Buffer 재사용 | [use-three-viewer.ts](../app/viewer/_hooks/use-three-viewer.ts) | 같은 런타임에서 position 배열을 재사용하고 `set`·`needsUpdate`·`setDrawRange`로 새 좌표를 반영한다. UI의 hit 표시 자체가 GPU 재사용을 측정하는 값은 아니다. |
| 사진 교체 | [use-buffered-camera-frame.ts](../app/viewer/_hooks/use-buffered-camera-frame.ts) | 보이는 사진을 유지하면서 숨긴 img에 목표 URL을 지정하고, 브라우저 `decode()` 완료 후 활성 슬롯을 교체한다. |
| 충돌 예상 구간 | [find-axis-aligned-trajectory-collision-segments.ts](../app/viewer/_analysis/find-axis-aligned-trajectory-collision-segments.ts) | 가상 계획 경로와 축 정렬 footprint의 겹친 선분을 강조한다. |

실제 데모의 연결 범위는 **LiDAR·CAM_FRONT·ego pose**다. 보행자 인식·Planning·급제동은 가상 데모에서 보여준다. `Frame 로딩`은 HTTP 응답 대기를 포함할 수 있으므로 순수 렌더 시간으로 읽지 않는다. 로컬 기준선 13.9ms·FPS 75를 공개 서비스의 보장 수치로 자막에 사용하지 않는다. 측정 조건은 [PERFORMANCE.md](./PERFORMANCE.md)를 따른다.

## 마지막 화면의 링크

- 데모: [drivescope-visualizer.vercel.app/viewer](https://drivescope-visualizer.vercel.app/viewer)
- 코드: [DoubleChamp/drivescope-visualizer](https://github.com/DoubleChamp/drivescope-visualizer)
- 기술 표기: Next.js · React · TypeScript · Three.js

완성한 영상에서 가상 12.0 → 12.4초의 경로 변화, 센서 시각과 캐시 표시를 확대해 읽을 수 있게 했다. README에 영상 링크를 추가하고 [ROADMAP](./ROADMAP.md)의 영상 항목을 완료로 바꿨다.

## 조작 리허설 결과

2026-10-04, 공개 Viewer의 격리된 Chrome에서 `node node_modules/.cache/drivescope-browser-check/rehearse-demo.mjs`를 실행해 검사 6개 묶음을 통과했다. 실제 재생·탐색, 가상 10초 등장·11초 객체 클릭, 12초 빨간 선 렌더·12.4초 제거, 100ms 방향키 이동과 12.0초·-400ms 센서 표시, cache hit를 확인했다. 객체 선택 뒤 구도를 다시 맞춘 1920×1080 화면에 Canvas·Camera·타임라인·동기화 패널이 함께 들어왔다. JS runtime exception은 0개였다.

편집 구간 6개가 끊김 없이 0~60초로 이어지는 것도 확인했다. 리허설 보고서·스크린샷은 Git 제외 캐시에 보관한다.

## 녹화·편집 방식과 검증

개인 데스크톱을 녹화하지 않고 격리된 Chrome에서 공개 Viewer를 조작했다. CDP `Page.startScreencast`가 보내는 JPEG 화면을 받아 15fps로 900장을 인코더에 전달했다. 로딩·조작 대기 구간은 촬영 구간 밖에 두었다. 실제 재생 장면 8초를 촬영한 뒤 Viewer 시각이 1.0초에서 8.9초로 진행했음을 확인했다.

촬영 도구의 핵심 흐름은 다음과 같다. Viewer의 React·Three.js 코드는 변경하지 않았다.

```javascript
await send('Page.startScreencast', { format: 'jpeg', quality: 90 });

// Chrome이 새 화면을 보내면 최신 JPEG를 보관하고 수신을 확인한다.
if (message.method === 'Page.screencastFrame') {
  latestFrame = Buffer.from(message.params.data, 'base64');
  send('Page.screencastFrameAck', { sessionId: message.params.sessionId });
}

// 1/15초 간격으로 현재 화면을 FFmpeg의 입력 스트림에 전달한다.
encoder.stdin.write(latestFrame);
```

FFmpeg 9.0.2로 캡처 화면 일부를 확대하고, 한글 자막을 영상 하단 여백에 넣어 H.264·yuv420p MP4로 편집했다. 자막 가독성을 수정한 현재 출력은 **60.000초·1920×1080·30fps·1,800프레임·3,064,913바이트**다. 15fps 캡처를 30fps로 출력할 때 기존 화면을 반복하며 새 움직임을 보간하지 않는다. 촬영·출력 fps는 앱 통계의 rAF FPS와 별개다. 마지막 링크 화면은 페이지 이동 완료 후 고정 캡처해 이전 화면이 남지 않게 했다.

검증 명령은 이번 컴퓨터의 Git 제외 캐시에 있는 임시 보조 스크립트다. 이 스크립트·브라우저 프로필·원본 영상·FFmpeg 실행 파일은 추적하지 않고, 최종 영상·자막·포스터와 촬영 설명을 저장소에 포함한다.

```powershell
node node_modules/.cache/drivescope-browser-check/record-demo.mjs
node node_modules/.cache/drivescope-browser-check/edit-demo.mjs
node node_modules/.cache/drivescope-browser-check/verify-demo-video.mjs
```

- FFprobe로 길이·크기·codec·pixel format·프레임 수를 확인하고 모든 프레임을 오류 없이 디코딩했다.
- 격리된 Chrome에서 MP4 시작 재생, 14·30·35·40·51·58초 탐색과 끝까지 재생을 통과했다. video error와 JS runtime exception은 0개였다.
- 주요 화면을 추출해 자막, 충돌 강조 전후, 12.0초·-400ms 센서 정보, `hit · 재사용`과 마지막 링크 화면을 확인했다.
- 로컬 Next.js 서버의 `/demo/drivescope-demo.mp4`는 HTTP 200·`video/mp4`로 제공된다. `public` 파일의 URL 규칙은 설치된 Next.js 가이드를 확인했다. 공개 사이트의 영상 경로는 사용자 push와 새 Vercel build 뒤에 확인한다.

## 자막 가독성 수정

SRT는 13개 문장의 내용과 시각을 유지한다. ASS의 `Caption` 스타일은 1920×1080 기준 `Fontname: Malgun Gothic`, `Fontsize: 52`, `Bold: -1`, `Alignment: 2`, `MarginV: 140`으로 정했다. `Bold: -1`은 굵게, `Alignment: 2`는 하단 가운데, `MarginV`는 하단 여백이다. 반투명 어두운 배경으로 밝은 화면에서도 글자를 구분한다. 이전 하단 여백 14에서 140으로 올려 네이티브 재생 바와 거리를 확보했다.

자막을 올리기만 하면 촬영된 Viewer 타임라인을 가릴 수 있다. 기본 화면은 1440×810으로 줄이고 1920×1080의 상단 가운데에 배치해 아래 270px을 남겼다. 센서 정보 확대 화면도 810px 아래로 내려오지 않도록 조정했다. 전체 편집에는 다른 장면의 확대·합성이 포함되며, 기본 화면 여백의 핵심 FFmpeg 필터는 다음과 같다.

```text
scale=1440:810,pad=1920:1080:240:0
```

MP4에는 자막 픽셀이 이미 들어 있다. ASS를 수정한 뒤 자막이 없는 촬영 원본에서 다시 출력해야 한다. 웹 CSS로 영상 속 자막 크기를 바꾸거나 기존 자막 위에 새 자막을 덧씌우지 않는다. 스타일 원본은 저장소에 포함하고 원본 촬영·편집 보조 도구는 기존처럼 Git 제외 캐시에 둔다.

모바일에서는 영상과 자막이 함께 축소되지만 브라우저 재생 버튼은 같은 비율로 줄지 않는다. 홈의 모바일 `.video`에 `aspect-ratio: 5 / 4`, `min-height: 260px`, `object-fit: contain`을 적용해 여백 안에 네이티브 컨트롤이 표시될 공간을 확보한다. 데스크톱은 16:9를 유지한다. 새 MP4·포스터의 네이티브 URL은 `?v=2`, 소개의 Next Image 포스터는 정적 import의 파일 해시로 이전 캐시와 구분한다.
