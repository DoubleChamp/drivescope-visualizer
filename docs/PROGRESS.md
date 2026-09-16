# DriveScope 진행 상황

마지막 갱신: 2026-09-16

## 현재 위치

- 현재 Phase: Phase 4 — 진행 중
- 현재 작업: 급제동 Event timestamp를 전체 재생 길이의 비율로 변환해 타임라인에 고정 마커로 표시했다.
- 다음 한 단계: Phase 4 일곱 번째 항목인 seek 직후 모든 센서 장면 갱신을 구현한다.
- 아직 구현하지 않은 것: 가상 카메라 이미지 파일, 선택된 센서 데이터의 실제 UI·Three.js 장면 반영과 분석 기능

## 완료한 작업

- `mockScenario.events`를 순회하고 `timestampMs / durationMs * 100`으로 각 이벤트의 타임라인 위치를 계산했다.
- `12.4초` 급제동 이벤트를 `82.666…%` 위치의 빨간 마커와 접근성 이름으로 표시했다.
- range 손잡이의 이동 구간과 마커 기준 구간을 맞추고 마커가 타임라인 드래그 입력을 막지 않게 했다.
- `findLatestFrameAtOrBefore`로 현재 재생 시각 이하의 가장 최신 Frame만 선택해 미래 센서 데이터를 미리 표시하지 않도록 했다.
- 같은 `currentTimeMs`에서 Camera·LiDAR·Object Detection을 각각 선택하고 Frame 시각과 재생 시각의 차이를 Viewer에 표시했다.
- 선택 결과를 별도 state로 복제하지 않고 `currentTimeMs`에서 파생하며, `useMemo`와 이진 탐색은 실제 병목이 측정될 때 검토하도록 `TODO`로 남겼다.
- `timestampMs`가 있는 어떤 Frame에도 재사용할 수 있는 제네릭 `findNearestFrame` 함수를 추가했다.
- 목표 재생 시각과 각 Frame의 절대 시간 차이를 비교하고, 동률이면 이전 Frame을 선택하며, 빈 배열이면 `null`을 반환하도록 했다.
- 작은 가상 데이터에서는 이해하기 쉬운 선형 탐색을 사용하고 실제 병목을 측정하기 전에는 이진 탐색을 도입하지 않기로 했다.
- `currentTimeMs`를 값으로 사용하는 0~15,000ms range 타임라인을 추가했다.
- 타임라인을 100ms 단위로 이동하고 조작 시 재생을 정지해 seek 결과를 유지하도록 했다.
- range의 밀리초 값을 `aria-valuetext`에서 초 단위 문자열로 제공했다.
- `isPlaying` state와 재생·정지 버튼을 추가했다.
- 100ms interval의 고정 횟수가 아니라 `performance.now()`의 실제 경과 시간으로 `currentTimeMs`를 계산했다.
- 정지 후 이어서 재생하고, 15초에 자동 정지하며 끝에서 다시 재생하면 0초로 돌아가게 했다.
- 재생 타이머 cleanup을 Three.js 렌더 루프 cleanup과 독립적으로 관리했다.
- `ViewerCanvas`에 밀리초 단위의 `currentTimeMs` React state를 만들고 초기값을 `0`으로 설정했다.
- 현재 재생 시각과 `mockScenario.durationMs`를 초 단위로 변환해 `0.0 / 15.0초`로 표시했다.
- 현재 Trajectory는 내 차량의 Planning 결과이며 물체의 관측 히스토리·속도와 미래 예측은 별도 책임임을 구분했다.
- 모든 데이터 스트림을 묶는 `ScenarioData`와 0~15초의 `mockScenario`를 정의했다.
- Camera는 1,000ms, LiDAR는 500ms 간격으로 생성해 서로 다른 수집 주기를 데이터로 표현했다.
- 10초 보행자 등장, 11초 객체 인식, 12초 충돌 예상, 12.4초 급제동과 13.4초 정지를 서로 독립된 데이터 스트림에 표현했다.
- 12초 Trajectory의 2,000ms 뒤 예상 위치가 보행자 중심과 겹치고, 실제 차량은 급제동 후 그 전에 정지하도록 구성했다.
- 특정 시각에 발생한 사건을 나타내는 `ScenarioEvent`를 정의했다.
- Event에 고유 `id`, 공통 시간축의 `timestampMs`, 현재 첫 데모에서 허용하는 `"emergency-braking"` 타입을 포함했다.
- Event를 Vehicle State와 분리된 스트림으로 관리해 사건 목록과 타임라인 마커를 독립적으로 조회하기로 했다.
- 실제 차량 상태의 측정 시각, 위치·방향, 속도와 가속도를 나타내는 `VehicleStateFrame`을 정의했다.
- 급제동 사건은 Vehicle State의 boolean으로 중복 저장하지 않고 독립 Event로 분리하기로 했다.
- Trajectory 점의 예상 시각과 같거나 가장 가까운 Vehicle State의 실제 위치를 공통 시간축에서 비교하기로 했다.
- 한 시점에 Planning이 생성한 미래 예상 경로를 나타내는 `TrajectoryFrame`과 개별 `TrajectoryPoint`를 정의했다.
- 각 경로 점에 생성 시점으로부터의 `offsetMs`와 예상 `position`을 두고 절대 예상 시각을 두 값의 합으로 계산하기로 했다.
- 과거 로그 안의 Trajectory는 당시 관점의 미래 예측이며 이후 실제 Vehicle State와 구분해 비교하기로 했다.
- 한 시점의 인식 결과를 나타내는 `ObjectDetectionFrame`과 개별 인식 객체 `ObjectDetection`을 정의했다.
- 객체에 프레임 사이에서 유지할 `id`, 차량·보행자 분류, 신뢰도와 3D 박스 중심·크기·yaw를 포함했다.
- 객체 배열의 인덱스가 아니라 안정적인 `id`로 같은 실제 객체를 선택하고 추적하기로 했다.
- `CameraFrame`에 촬영 시점 `timestampMs`와 직렬화 가능한 이미지 위치 `imageUrl`을 정의했다.
- Camera 데이터에는 브라우저 이미지 객체나 Three.js Texture를 넣지 않고 실제 로딩 책임을 UI·렌더링 계층에 남겼다.
- `LidarFrame`에 측정 시점 `timestampMs`와 연속 좌표 `Float32Array`인 `positions`를 정의했다.
- 포인트 수는 `positions.length / 3`으로 계산하고 중복 필드로 저장하지 않기로 했다.
- 순수 센서 데이터가 Three.js에 종속되지 않도록 `BufferAttribute`와 `BufferGeometry`는 Frame 타입에 넣지 않았다.
- 모든 Frame과 Event의 시간 필드를 `timestampMs`로 통일하고 가상 시나리오 시작을 `0ms`로 정했다.
- 시나리오 내부 시간은 정수 밀리초로 저장하고 화면에 표시할 때만 초 단위로 변환하기로 했다.
- rAF의 timestamp는 브라우저 실행 시계이며 센서 시각이 아니므로 프레임 간 경과 시간 계산에만 사용하기로 했다.
- 센서별 주기가 다르므로 같은 배열 인덱스를 맞추지 않고, 이후 재생 시각과 각 Frame의 `timestampMs` 차이로 Frame을 선택하기로 했다.
- 사용자가 실제 화면에서 `측정 중 → 60 FPS` 전환을 확인했다.
- `POINTS_PER_SIDE = 10`인 포인트 100개와 `POINTS_PER_SIDE = 100`인 포인트 10,000개를 각각 측정했으며 둘 다 60 FPS였다. 두 장면 모두 현재 모니터 주사율과 rAF의 프레임 예산 안에서 실행됐다는 뜻이며 CPU·GPU 비용이 같다는 뜻은 아니다.
- 모듈 상수를 바꾼 이번 비교는 각 설정으로 Geometry를 새로 만든 뒤의 정상 상태 렌더링을 측정했다. 실행 중 Buffer 크기를 바꾸거나 일부 좌표를 갱신하는 성능은 측정하지 않았다.
- 사용자가 rAF timestamp의 밀리초 단위와 `렌더 횟수 × 1000 / 실제 경과 밀리초`가 1초 기준 평균 FPS가 되는 이유, 매 프레임이 아니라 약 1초마다 표시용 React state만 갱신하는 이유를 설명했다.
- 포인트 생성과 통계 표시가 같은 `POINT_COUNT` 상수를 사용하게 해 실제 포인트 수와 UI 값이 함께 바뀌도록 했다.
- 기존 rAF에서 렌더 횟수를 세고 실제 경과 시간이 1초 이상일 때 평균 FPS를 계산하며, React의 표시용 state는 약 1초에 한 번만 갱신한다.
- Canvas 위에 포인트 수 10,000과 FPS를 보여 주는 통계 UI를 추가했다. 첫 샘플 전에는 `측정 중`을 표시하고 숫자는 고정 폭으로 정렬한다.
- FPS 측정용 timer를 따로 만들지 않아 기존 `cancelAnimationFrame()`이 렌더 루프와 측정을 함께 중지한다.
- 사용자가 `Points`는 Mesh와 비슷한 하나의 렌더링 객체지만 점 primitive를 사용하고, 위치는 점마다 다른 Attribute이며 Material의 색상과 크기는 한 draw call의 모든 점이 공유함을 설명했다.
- 사용자가 `sizeAttenuation`은 GPU vertex shader가 각 점의 카메라 공간 깊이를 사용해 먼 점의 크기를 줄이는 계산이며 점 사이의 보간이 아님을 설명했다.
- 하나의 `PointsMaterial`에서 모든 점에 공통 적용되는 색상을 밝은 청록색 `0x38bdf8`, 크기를 `0.06`으로 조정했다.
- Material 변경은 위치 `Float32Array`, `BufferAttribute`, Geometry와 `Points` 개수를 바꾸지 않으며 기존 cleanup의 `pointsMaterial.dispose()`를 그대로 사용한다.
- 설치된 Three.js에서 `sizeAttenuation`의 기본값이 `true`이고 PerspectiveCamera의 깊이에 따라 점의 화면 크기를 조절함을 소스와 런타임으로 확인했다.
- 사용자가 10,000개 점에 좌표가 세 개씩 필요하고 `Float32` 한 요소가 4바이트라서 위치 데이터가 120,000바이트임을 설명했다. 또한 하나의 `Points`가 모든 좌표를 담은 Geometry를 참조하는 구조를 설명했다.
- 100개처럼 짝수 개의 점을 일정 간격으로 배치하면 원점은 가운데 두 점 사이에 놓이며, `((개수 - 1) * 간격) / 2`를 빼야 양 끝 좌표가 원점 대칭이 됨을 확인했다.
- 같은 `Float32Array`·`BufferAttribute`·`Points` 구조를 유지한 채 가상 포인트를 10×10에서 100×100, 총 10,000개로 확장했다.
- 숫자 30,000개가 120,000바이트를 차지하고 `itemSize: 3`인 Attribute의 `count`가 10,000임을 Three.js 런타임에서 확인했다.
- 점 사이 간격을 0.1로 두고 XZ 좌표를 `-4.95~4.95`에 배치해 `GridHelper(10, 10)` 범위 안을 채웠다.
- Viewer의 정적 안내 문구도 실제 포인트 수인 10,000개로 맞췄다.
- 사용자가 rAF 취소는 다음 콜백의 실행을 막으며, 살아 있는 콜백의 closure가 객체를 참조하면 GC가 회수하지 못함을 설명했다.
- 사용자가 `scene.clear()`의 자식 연결 해제와 `dispose()`의 그래픽 리소스 정리를 구분했다. Grid는 Geometry와 Material 모두 정리하며 현재 Renderer는 WebGL 기반임을 보완 설명했다.
- 기존 `ViewerCanvas` effect에서 `Vector3` 100개를 만들고 `BufferGeometry.setFromPoints()`, `PointsMaterial`, `Points`로 한 묶음의 점을 추가했다.
- 점은 10×10 배열, XZ 간격 0.5, 높이 0.25로 배치하고 노란색과 크기 0.1을 적용했다. 좌표와 리소스는 매 프레임 새로 생성하지 않는다.
- 기존 cleanup에 포인트 Geometry와 Material의 `dispose()`를 추가하고 Viewer의 안내 문구를 현재 화면에 맞췄다.
- 사용자가 좌표, Geometry, Material과 하나의 `Points`가 맡는 역할 및 Geometry·Material의 정리 시점을 설명해 포인트 100개 구성의 이해를 확인했다.
- Canvas의 동일성은 `id`가 아니라 React가 비교하는 컴포넌트 타입, 렌더 트리 위치와 `key`에 따라 결정됨을 확인했다.
- 설치된 Three.js 소스에서 `setFromPoints()`가 `Vector3[]`의 좌표를 중간 JavaScript 배열에 모은 뒤 새 `Float32Array` 기반 `Float32BufferAttribute`로 복사하는 흐름을 확인했다.
- 런타임 검사에서 100개 좌표가 `itemSize` 3, `count` 100, 숫자 300개인 위치 Attribute가 되며 원본 `Vector3` 수정은 변환된 Attribute에 자동 반영되지 않음을 확인했다.
- 현재처럼 100개를 마운트 시 한 번 만드는 비용은 작지만, 큰 포인트클라우드를 Frame마다 객체 배열로 만들면 객체 할당과 변환 복사가 늘어나는 한계를 확인했다.
- 사용자가 원본 `Vector3`와 변환된 Geometry의 위치 데이터가 별개인 이유와, 큰 객체 배열에서 추가 할당과 반복 변환이 부담이 될 수 있음을 설명했다.
- 한 점의 위치 변경은 Geometry 전체 재생성을 요구하지 않으며, 기존 위치 배열의 세 요소와 GPU Buffer의 해당 범위만 갱신할 수 있음을 설치된 Three.js 소스로 확인했다.
- rAF의 `render()`는 모든 점을 다시 그리지만 기존 좌표를 JavaScript에서 다시 계산하는 과정은 아니며, 현재 Geometry와 GPU Buffer를 재사용함을 확인했다.
- `Float32Array(300)`에 포인트 100개의 좌표를 연속 배치하고, 점 `i`가 `i * 3`부터 세 슬롯을 사용함을 런타임에서 확인했다.
- `Vector3[]`와 `setFromPoints()`를 제거하고 직접 만든 `Float32Array`를 `BufferAttribute`의 입력으로 연결했다.
- `BufferAttribute`가 입력 배열을 같은 참조로 보관하고 `itemSize: 3`, `count: 100`으로 해석하는 것을 런타임에서 확인했다.
- 이전 방식과 새 방식의 위치 숫자 300개를 비교해 불일치가 없음을 확인했다.
- Scene 순회는 좌표 배열을 비교하지 않으며, `needsUpdate`가 올린 Attribute 버전을 Renderer의 캐시 버전과 비교해 GPU 재전송 여부를 정함을 설치된 Three.js 소스로 확인했다.
- 변화가 없는 Attribute는 기존 GPU Buffer를 재사용하지만 `renderer.render()`마다 점을 그리는 draw call은 다시 발생함을 확인했다.
- 빈 `main` 브랜치와 GitHub `origin` 연결 상태를 확인했다.
- 원격 저장소에 아직 브랜치가 없어 pull할 변경이 없음을 확인했다.
- GitHub Desktop 내장 Git으로 저장소를 관리하기로 결정했으며 Git for Windows CLI는 별도로 설치하지 않았다.
- Node.js `24.20.0`, npm `11.19.0`, pnpm `11.24.0`을 설치하고 명령 실행을 확인했다.
- Next.js App Router와 TypeScript 프로젝트를 최소 구성으로 초기화했다.
- Tailwind CSS, ESLint, React Compiler, React Three Fiber는 추가하지 않았다.
- Three.js `0.185.1`과 `@types/three` `0.185.4`를 설치했다.
- DriveScope 작업 규칙과 프로젝트 안내 문서를 작성했다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`를 처음에는 로컬 전용으로 두었지만, 두 컴퓨터의 Codex가 같은 기준을 사용하도록 Git 추적 문서로 전환했다.
- `main`에 첫 커밋 `8d7c3f2 초기 환경 구성`을 만들고 `origin/main`과 동기화했다.
- `main`에서 `feat/phase-1-three-scene` 브랜치를 생성했다.
- 홈에서 Viewer로 이동하는 `Link`와 `/viewer` 페이지를 추가했다.
- 홈과 Viewer 페이지를 Server Component로 유지하고 Three.js 코드는 추가하지 않았다.
- `ViewerCanvas`만 Client Component로 분리하고 React가 소유하는 빈 `<canvas>`와 DOM `ref`를 만들었다.
- CSS Module로 Canvas의 크기와 배경을 지정해 빈 영역을 확인할 수 있게 했다.
- `ViewerCanvas`의 `useEffect`에서 빈 Three.js `Scene`을 만들고 cleanup에서 자식 목록을 비우도록 했다.
- 같은 `useEffect`에서 Canvas의 현재 비율로 `PerspectiveCamera`를 만들고, 위치 `(5, 5, 5)`에서 원점을 바라보도록 설정했다.
- 사용자가 세로 `fov`, Canvas `aspect`, `near`·`far`, Camera 위치·방향과 Renderer가 없을 때 화면이 비는 이유를 설명했다.
- `WebGLRenderer`에 React가 소유하는 Canvas를 전달하고, 현재 CSS 크기로 drawing buffer와 viewport를 설정했다.
- `renderer.render(scene, camera)`를 한 번 호출하고 cleanup에서 `renderer.dispose()`로 Renderer 리소스를 정리하도록 했다.
- 사용자가 1회 렌더는 화면에 유지되고 장면이 바뀔 때 새 프레임을 그리려면 다시 렌더해야 한다는 차이를 확인했다.
- `GridHelper(10, 10)`를 Scene의 자식으로 추가해 원점을 중심으로 한 XZ 평면의 공간 기준을 만들었다.
- Grid는 조명을 계산하지 않는 선 재질을 사용하므로 이번 단계에 Light를 추가하지 않았다.
- cleanup에서 `grid.dispose()`로 Grid가 가진 Geometry와 Material을 정리한 뒤 Scene과 Renderer를 정리하도록 했다.
- `/viewer`의 안내 문구를 빈 Canvas가 아닌 공간 기준 Grid를 표시하는 Canvas라는 현재 상태에 맞췄다.
- 사용자가 Grid의 전체 크기와 분할 수, 조명을 계산하지 않는 선 재질, Scene 분리와 GPU 리소스 정리의 차이를 설명했다.
- `handleResize`에서 Canvas의 현재 CSS 크기를 읽어 `camera.aspect`를 갱신하고 `camera.updateProjectionMatrix()`를 호출하도록 했다.
- resize 처리에서 `renderer.setSize(..., false)`로 drawing buffer와 viewport를 갱신하고, 실제 그리기는 이후 추가한 렌더 루프가 담당하도록 했다.
- 컴포넌트 마운트 시 resize 처리를 한 번 실행하고 `window` 이벤트를 등록하며, cleanup에서 같은 핸들러를 제거하도록 했다.
- 사용자가 `aspect`는 설정값이고 `updateProjectionMatrix()`가 Camera 내부의 실제 투영 행렬을 다시 계산하며 `render()`가 그 행렬을 사용한다는 차이를 설명했다.
- 최초 `requestAnimationFrame`을 하나만 예약하고, `renderFrame`이 Scene을 그린 뒤 다음 프레임 하나를 다시 예약하도록 했다.
- 가장 최근 animation frame ID를 계속 저장하고 cleanup에서 `cancelAnimationFrame()`으로 먼저 취소하도록 했다.
- 연속 렌더 루프가 그리기를 담당하므로 resize 핸들러에서는 중복 `renderer.render()` 호출을 제거했다.
- 매 프레임 React state를 갱신하지 않고 effect 내부의 Three.js 런타임에서 직접 렌더링하도록 유지했다.
- 사용자가 rAF는 동기 재귀가 아니라 브라우저가 다음 화면 갱신에 맞춰 한 번씩 실행하는 예약이며, Canvas 픽셀 갱신에는 매 프레임 React 비교가 필요하지 않음을 설명했다.
- 설치된 Three.js 소스를 기준으로 `GridHelper.dispose()`, `Scene.clear()`와 `WebGLRenderer.dispose()`의 실제 범위를 감사했다.
- 현재 cleanup 순서가 외부 실행 차단, 사용자 GPU 리소스 해제, Scene 연결 해제, Renderer 내부 정리 순서임을 확인했다.
- Camera와 Scene은 JS 객체이므로 별도 `dispose()`가 필요 없고 Canvas DOM은 React가 소유하므로 직접 제거하지 않는 것이 맞음을 확인했다.
- 필수 cleanup 누락이 없어 이번 감사에서는 애플리케이션 코드를 수정하지 않았다.
- Phase 1을 완료 처리하고 코드와 공유 문서를 `6048ba1 feat: Viewer Three.js 기본 장면 완성`으로 commit한 뒤 GitHub Desktop에서 `origin`에 push했다.
- 이후 승인된 단계는 검증과 문서 갱신 후 Codex가 현재 브랜치에 commit까지만 하고, `origin` push는 사용자가 GitHub Desktop에서 직접 수행하도록 작업 규칙을 변경했다.

## 검증 결과

### Phase 4: 급제동 이벤트 타임라인 마커 (2026-09-16)

- `12_400 / 15_000 * 100`의 결과인 `82.66666666666667%`가 급제동 마커의 인라인 위치로 렌더링됨을 확인했다.
- `/viewer` 초기 HTML에 `급제동 12.4초` 문구와 `viewer-timeline`의 label·input 연결이 포함됨을 확인했다.
- 1280×900 headless Chrome 화면에서 타임라인 오른쪽의 해당 비율 위치에 빨간 급제동 마커와 문구가 표시됨을 확인했다.
- `pnpm exec tsc --noEmit`: TypeScript 오류 없이 통과했다.
- `pnpm build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- 실행 중인 `/viewer`가 HTTP 200으로 응답했다.
- `git diff --check`: 공백 오류 없음.

### Phase 4: 서로 다른 주기의 센서 Frame 동기화 (2026-09-16)

- `12_400ms`에서 Camera·LiDAR·Object Detection 모두 미래 Frame을 선택하지 않고 각 배열의 최신 과거 Frame인 `12_000ms`를 선택함을 확인했다.
- 빈 배열과 첫 Frame보다 이른 목표 시각에서 `findLatestFrameAtOrBefore`가 `null`을 반환함을 확인했다.
- Viewer 초기 화면에서 세 센서의 `0.0초` Frame과 재생 시각 차이 `0ms`가 표시됨을 확인했다.
- `pnpm exec tsc --noEmit`: TypeScript 오류 없이 통과했다.
- `pnpm build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- 실행 중인 `/viewer`가 HTTP 200으로 응답하고 동기화된 Camera·LiDAR·Object Detection 항목을 포함함을 확인했다.
- `git diff --check`: 공백 오류 없음.

### Phase 4: 최근접 Frame 선택 함수 (2026-09-16)

- `12_400ms`에서 Camera `12_000ms`, LiDAR `12_500ms`, Object Detection `12_000ms`, Trajectory와 Vehicle State `12_400ms`가 선택됨을 실제 `mockScenario`로 확인했다.
- `0ms`와 `1_000ms` 사이의 `500ms` 동률에서 이전 `0ms`가 선택되고 빈 배열에서는 `null`이 반환됨을 확인했다.
- `pnpm exec tsc --noEmit`: TypeScript 오류 없이 통과했다.
- `pnpm build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- `git diff --check`: 공백 오류 없음.

### Phase 4: 타임라인 드래그 (2026-09-16)

- `currentTimeMs`를 값으로 사용하는 제어된 range input을 추가하고 `valueAsNumber`로 선택 시각을 반영했다.
- range의 `min=0`, `max=15000`, `step=100`, 초기 `value=0`을 실행 중인 `/viewer` 응답에서 확인했다.
- 타임라인 변경 시 `isPlaying`을 false로 바꿔 활성 재생 interval이 선택한 시각을 덮어쓰지 않게 했다.
- `aria-valuetext`가 현재 밀리초 값을 `0.0초`, `12.4초` 같은 접근성용 문자열로 변환하며 재생 계산에는 관여하지 않음을 확인했다.
- 사용자가 재생을 멈추지 않으면 기존 interval과 드래그 입력이 같은 state를 갱신해 선택 시각이 흔들리거나 덮어써질 수 있다고 설명했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `pnpm.cmd build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 초기 재생 버튼, Canvas와 range 타임라인을 포함함을 확인했다.
- `git diff --check`: 공백 오류 없음.

### Phase 4: 재생과 정지 (2026-09-16)

- `isPlaying` state에 따라 버튼 문구와 재생 interval이 함께 시작·정지하도록 구현했다.
- 재생 기준 시각은 React 렌더링에 사용하지 않는 ref에 보관하고 100ms마다 실제 경과 시간을 측정해 `currentTimeMs`를 갱신한다.
- 15,000ms에서 자동 정지하고 끝에서 다시 재생하면 0ms부터 시작하도록 했다.
- 재생 effect cleanup이 interval을 제거하며 기존 Three.js 초기화 effect와 rAF 렌더 루프는 변경하지 않았다.
- 사용자가 `setInterval`은 정확한 주기를 보장하지 않으므로 재생 시작 시각과 callback 시각의 실제 차이를 계산해 state에 반영해야 한다고 설명했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `pnpm.cmd build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 초기 `재생` 버튼, 재생 시간과 Canvas 마크업을 포함함을 확인했다.
- `git diff --check`: 공백 오류 없음.

### Phase 4: 현재 재생 시간 상태 (2026-09-16)

- `ViewerCanvas`의 `currentTimeMs` state를 `0ms`로 초기화하고 `mockScenario.durationMs`와 함께 초 단위로 표시했다.
- 현재 단계에서는 state setter, 자동 시간 증가, 재생 버튼, Frame 선택과 Three.js 데이터 갱신을 추가하지 않았다.
- 사용자가 시간축 변경을 화면에 보여 주기 위해 `currentTimeMs`를 React state로 관리한다고 설명했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `pnpm.cmd build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 `재생 시간`, `0.0 / 15.0초` 마크업을 포함함을 확인했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: 가상 급제동 시나리오 데이터 (2026-09-15)

- `ScenarioData`가 시나리오 식별자·길이와 여섯 종류의 Frame·Event 배열을 하나로 묶도록 정의했다.
- 15,000ms 시나리오에 Camera 16개, LiDAR 31개, Object Detection 16개, Trajectory 5개, Vehicle State 18개와 Event 1개가 생성됨을 Node 런타임에서 확인했다.
- 모든 스트림이 `timestampMs` 오름차순이며 첫 보행자 인식은 11,000ms, 급제동 Event는 12,400ms임을 확인했다.
- 12,400ms Vehicle State의 가속도는 `-4m/s²`, 13,400ms의 속도는 `0m/s`임을 확인했다.
- 사용자가 Camera와 LiDAR는 같은 배열이 아니므로 같은 인덱스를 사용하지 않고 재생 시각과 각 스트림의 timestamp를 비교해 Frame을 각각 선택해야 한다고 설명했다.
- 가상 카메라 URL이 가리키는 SVG 파일과 Viewer 연결은 이번 데이터 모델 범위에 포함하지 않았다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `pnpm.cmd build`: Next.js 16.3.3 production build와 `/viewer` 정적 페이지 생성이 통과했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: Event 타입 (2026-09-15)

- `ScenarioEvent`에 사건을 구별하는 `id`, 발생 시각 `timestampMs`, 사건 종류 `type`을 정의했다.
- 현재 `type`은 첫 데모에 필요한 `"emergency-braking"`만 허용하고 실제로 다른 사건이 필요할 때 문자열 유니온을 확장하기로 했다.
- 사용자가 Event를 독립 스트림으로 관리하면 상태 배열을 하나씩 검색하거나 중복 여부를 검사하지 않고 사건 목록과 타임라인 마커를 독립적으로 처리하기 쉽다고 설명했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: Vehicle State 타입 (2026-09-15)

- `VehicleStateFrame`에 실제 측정 시점 `timestampMs`, `position`, `yawRadians`, `speedMetersPerSecond`와 `accelerationMetersPerSecondSquared`를 정의했다.
- 가속도는 진행 방향 기준의 부호 있는 값으로 두어 감속을 음수로 표현한다.
- 급제동 여부를 상태 boolean으로 중복 저장하지 않고 다음 단계의 독립 Event로 표현하기로 했다.
- 사용자가 사건은 Event 타입에서 관리하고, Trajectory 예상 시각과 Vehicle State 측정 시각을 공통 시간축에서 비교해야 한다고 설명했다.
- 여기서 공통 기준은 Unix 절대 시각이 아니라 시나리오 시작 `0ms` 기준이며 예상 시각은 `TrajectoryFrame.timestampMs + TrajectoryPoint.offsetMs`임을 보완했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: Trajectory 타입 (2026-09-15)

- `TrajectoryPoint`에 예측 생성 시점으로부터의 `offsetMs`와 예상 3D `position`을 정의했다.
- `TrajectoryFrame`이 Planning의 생성 시점 `timestampMs`와 순서가 있는 `TrajectoryPoint[]`를 묶도록 했다.
- 한 점의 예상 시각은 Frame의 `timestampMs + offsetMs`로 계산하며, 동일 시각의 실제 차량 위치와는 구분한다.
- 사용자가 현재는 과거 데이터를 재생하지만 Trajectory에는 당시 AI가 판단을 위해 예측한 미래 경로를 담는 구조라고 설명했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: Object Detection 타입 (2026-09-15)

- `ObjectDetection`에 `id`, `vehicle | pedestrian` 분류, `confidence`, 3D 박스의 `center`, `width, length, height` 크기와 `yawRadians`를 정의했다.
- `ObjectDetectionFrame`이 하나의 `timestampMs`와 같은 시점에 인식된 `ObjectDetection[]`를 묶도록 했다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- 사용자가 한 Frame에 여러 객체가 인식될 수 있어 Frame과 개별 객체를 분리하며, 같은 실제 객체는 이전·현재 Frame에서 같은 ID를 가져야 한다고 설명했다.
- 순수 detector의 출력만으로 동일 ID가 생기는 것은 아니며 tracker나 데이터 변환 단계가 안정적인 ID를 제공해야 한다는 점을 보완했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: Camera Frame 타입 (2026-09-15)

- 기존 `_data/frame-types.ts`에 `CameraFrame` 타입을 추가했다.
- 타입은 정수 밀리초 기준의 `timestampMs`와 이미지 위치 문자열 `imageUrl`만 가진다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- 사용자가 문자열 URL은 Server Component에서 Client Component로 단방향 전달할 수 있고 실제 이미지는 이후 렌더링 계층에서 로딩한다고 설명했다.
- 현재 MVP의 전방 카메라 패널에서는 React가 `<img>` UI를 구성하고 브라우저가 파일 요청과 디코딩을 담당한다는 점을 보완했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: LiDAR Frame 타입 (2026-09-15)

- Next.js의 `/viewer` 라우트와 함께 둘 수 있는 내부 `_data/frame-types.ts`에 `LidarFrame` 타입을 추가했다.
- 타입은 정수 밀리초 기준의 `timestampMs`와 `[x, y, z, ...]` 좌표를 담는 `Float32Array`인 `positions`만 가진다.
- `pnpm.cmd exec tsc --noEmit --incremental false`: TypeScript 오류 없이 통과했다.
- 사용자가 CPU의 `Float32Array` 변경을 GPU가 자동 감지하지 않으며 `needsUpdate`와 이후 렌더가 필요함을 설명했다.
- 현재 rAF 루프에서는 다음 `renderer.render()`가 자동으로 실행되지만 정적 1회 렌더 구조라면 변경 후 직접 다시 렌더해야 함을 확인했다.
- `git diff --check`: 공백 오류 없음.

### Phase 3: 공통 timestamp 단위와 기준 시점 (2026-09-15)

- 애플리케이션 코드를 변경하지 않고 Frame 데이터 모델이 사용할 공통 시간 규칙을 먼저 결정했다.
- 내부 단위는 정수 밀리초, 기준 시점은 가상 시나리오 시작 `0ms`, 공통 필드명은 `timestampMs`로 정했다.
- 사용자가 공통 규격이 데이터 비교와 사용을 단순하게 하며, 센서별 주기가 달라 같은 배열 인덱스로 시계열을 동기화할 수 없음을 설명했다.
- 원본 Camera와 LiDAR Frame은 보간이 항상 필요한 것이 아니라 우선 timestamp 차이로 가장 가까운 Frame을 선택한다는 점을 보완했다.
- 설치된 Next.js `16.3.3`의 프로젝트 구조와 Server/Client Components 문서를 확인했다. 이후 순수 TypeScript 데이터 모듈은 `/viewer`와 함께 배치하되 라우트 구현과 구분하고 `'use client'`를 추가하지 않는다.
- `git diff --check`: 공백 오류 없음.

### Phase 2: 포인트 수와 FPS 표시 (2026-09-14~15)

- 작업 시작 전 GitHub Desktop 내장 Git으로 `fetch origin`을 실행했다. 원격의 새 커밋은 없었고 로컬 `main`은 직전 두 커밋으로 `origin/main`보다 2커밋 앞선 깨끗한 상태였다.
- 설치된 Next.js의 Server and Client Components 및 `use client` 가이드를 확인하고 기존 `ViewerCanvas` Client Component 안에서 표시용 state를 추가했다.
- TypeScript Compiler를 `--noEmit --incremental false`로 실행해 오류 없이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 Canvas, `뷰어 통계`, 포인트 수 `10,000`, `FPS`와 초기값 `측정 중`을 포함함을 확인했다.
- 1초 구간의 rAF timestamp를 모사한 계산 검사에서 60Hz 입력은 60 FPS, 30Hz 입력은 30 FPS가 됨을 확인했다.
- 사용자가 브라우저에서 통계 오버레이의 `측정 중`이 60 FPS로 바뀌는 것을 확인했다. 포인트 100개와 10,000개 모두 60 FPS였으며, 이는 두 부하가 모두 현재 60Hz rAF 예산 안에 들어온 결과로 해석했다.
- 모듈 상수 변경으로 각 장면을 다시 만든 뒤 정상 상태 FPS를 비교했으므로 동적 Buffer 재할당이나 부분 좌표 갱신 비용을 측정한 결과는 아니다.
- `git diff --check`: 공백 오류 없음.

### Phase 2: `PointsMaterial` 색상과 크기 조정 (2026-09-14)

- 작업 시작 전 GitHub Desktop 내장 Git으로 `fetch origin`을 실행했다. 원격의 새 커밋은 없었고 로컬 `main`은 직전 10,000포인트 커밋으로 `origin/main`보다 1커밋 앞선 깨끗한 상태였다.
- 설치된 Next.js의 Server and Client Components 가이드와 Three.js `PointsMaterial` 및 포인트 vertex shader 소스를 확인하고 기존 `ViewerCanvas` Client Component 경계 안에서 변경했다.
- TypeScript Compiler를 `--noEmit --incremental false`로 실행해 오류 없이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 Canvas와 가상 포인트 10,000개 안내를 포함함을 확인했다.
- Three.js 런타임에서 Material의 `color: 0x38bdf8`, `size: 0.06`, `sizeAttenuation: true`, `vertexColors: false`, `map: null`을 확인했다.
- 브라우저 연결이 제공되지 않아 청록색 점의 크기와 Grid 가독성은 자동 육안 검사하지 못했다. Material 런타임 값, TypeScript 검사와 개발 서버 응답으로 코드 경로를 검증했다.
- `git diff --check`: 공백 오류 없음.

### Phase 2: 가상 포인트 10,000개 확장 (2026-09-14)

- 작업 시작 전 GitHub Desktop 내장 Git으로 `fetch origin`을 실행했고 로컬 `main`과 `origin/main`이 일치하며 worktree가 깨끗함을 확인했다.
- TypeScript Compiler를 `--noEmit --incremental false`로 실행해 오류 없이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 Canvas, `DriveScope 3D` 레이블 및 가상 포인트 10,000개 안내를 포함함을 확인했다.
- Three.js 런타임 검사에서 위치 배열의 `length: 30000`, `byteLength: 120000`, Attribute의 `itemSize: 3`, `count: 10000`과 입력 배열을 같은 참조로 보관함을 확인했다.
- 첫 점은 Float32 정밀도에서 약 `(-4.95, 0.25, -4.95)`, 마지막 점은 약 `(4.95, 0.25, 4.95)`였다.
- 브라우저 연결이 제공되지 않아 이번 변경의 WebGL 픽셀과 실제 draw call은 자동 검사하지 못했다. 좌표 구조 런타임 검사, TypeScript 검사와 개발 서버 응답으로 구현 범위를 검증했다.
- `git diff --check`: 공백 오류 없음.

### Phase 2: `Float32Array`와 `BufferAttribute` 직접 연결 (2026-09-13)

- 작업 시작 전 GitHub Desktop 내장 Git으로 `fetch origin`을 실행했다. 로컬 `main`은 원격보다 2커밋 앞서 있었고 원격의 새 커밋과 미커밋 변경은 없었다.
- 설치된 Next.js의 Server and Client Components 및 `use client` 가이드를 확인하고 기존 `ViewerCanvas` Client Component 경계 안에서 변경했다.
- TypeScript Compiler를 `--noEmit --incremental false`로 실행해 오류 없이 통과했다.
- 실행 중인 개발 서버의 `/viewer`가 HTTP 200으로 응답하고 Canvas 및 `DriveScope 3D` 레이블을 포함함을 확인했다.
- Three.js 런타임 검사에서 `BufferAttribute`가 입력 `Float32Array`를 같은 참조로 사용하며 `itemSize: 3`, `count: 100`, `byteLength: 1200`임을 확인했다.
- 첫 점 `(-2.25, 0.25, -2.25)`과 마지막 점 `(2.25, 0.25, 2.25)`을 확인했다. 이전 `setFromPoints()` 결과와 숫자 300개를 비교한 결과 불일치는 0개였다.
- 브라우저 연결이 제공되지 않아 WebGL 픽셀과 실제 draw call의 재검사는 수행하지 못했다. 기존과 동일한 위치 데이터, TypeScript 검사와 개발 서버 응답으로 변경 범위를 검증했다.
- `git diff --check`: 공백 오류 없음.

### Phase 2: `Float32Array` 좌표 구조 (2026-09-13)

- 작업 시작 시 `main`은 직전 문서 커밋으로 `origin/main`보다 1커밋 앞서 있었고 미커밋 변경은 없었다.
- Node 런타임에서 `Float32Array(100 * 3)`의 길이 300, 요소당 4바이트, 전체 좌표 데이터 1,200바이트를 확인했다.
- 37번 포인트의 좌표가 111, 112, 113번 슬롯에 놓이며 해당 세 슬롯만 변경했을 때 인접 포인트가 바뀌지 않음을 확인했다.
- 설치된 Three.js `0.185.1` 소스에서 한 점의 세 요소만 수정하고 `addUpdateRange()`로 GPU 부분 갱신 범위를 지정할 수 있음을 확인했다.
- 현재 rAF는 `renderer.render()`만 호출하며 `setFromPoints()`나 Geometry 생성은 반복하지 않음을 애플리케이션 코드에서 확인했다.
- 애플리케이션 코드는 변경하지 않았다. 이번 항목은 연속 좌표 배열의 구조를 런타임으로 확인하고 문서화하는 범위다.
- `git diff --check`: 공백 오류 없음. 문서 외 애플리케이션 파일 변경 없음.

### Phase 2: `Vector3` 객체 배열 구조와 한계 (2026-09-13)

- 작업 시작 전 GitHub Desktop에서 `Fetch origin`을 실행했다. 로컬 `main`과 `origin/main`은 `bbd7d4d`로 일치했고 미커밋 변경이 없었다.
- 설치된 Three.js `0.185.1`의 `Vector3`, `BufferGeometry.setFromPoints()`와 `Float32BufferAttribute` 구현을 직접 읽어 객체 좌표가 연속 메모리 배열로 복사되는 흐름을 확인했다.
- Node 런타임 검사 결과: `Vector3` 100개 → `Float32BufferAttribute`, 내부 배열 `Float32Array`, `itemSize: 3`, `count: 100`, 배열 길이 300.
- 변환 뒤 첫 번째 `Vector3.x`를 수정해도 Attribute의 첫 번째 값이 바뀌지 않아 원본 객체와 최종 위치 Buffer가 별도 데이터임을 확인했다.
- 애플리케이션 코드는 변경하지 않았다. 이 항목은 현재 데이터 구조를 분석하고 문서에 결과를 기록하는 범위다.
- `git diff --check`: 공백 오류 없음. 문서 외 애플리케이션 파일 변경 없음.

### Phase 2: 가상 포인트 100개 (2026-09-08)

- GitHub Desktop 내장 Git의 `ls-remote origin refs/heads/main` 결과와 로컬 `HEAD`가 `9cfb85a`로 일치했고 작업 시작 시 미커밋 변경이 없었다.
- 설치된 Next.js의 Server and Client Components 가이드와 Three.js `setFromPoints()` 소스를 읽고 기존 Client Component 경계 안에 구현했다.
- `pnpm.cmd build`: 컴파일, TypeScript 검사와 `/viewer` 정적 페이지 생성 통과. PowerShell 실행 정책에 따라 `.ps1` 대신 `.cmd` 실행 파일을 사용했다.
- Chrome headless와 CDP로 기존 개발 서버의 `/viewer`를 실행했다. 실제 WebGL2 `drawArrays(POINTS, ..., 100)`와 스크린샷의 노란 10×10 점 배치를 확인했다.
- 창 크기를 변경했을 때 Canvas drawing buffer가 `1264×630`에서 `944×504`로 바뀌고 CSS 표시 크기와 일치했다.
- SPA 홈 이동 시 Canvas가 제거되고 포인트 draw 횟수가 더 증가하지 않았다. cleanup에서 WebGL buffer 삭제 3회와 program 삭제 2회를 관찰했다.
- Viewer 재진입 시 Canvas 1개와 포인트 100개 렌더링이 복원되었다. 동일한 페이지 전역 식별자로 전체 새로고침 없이 검사했음을 확인했다.
- 임시 검증 명령: `node node_modules/.cache/drivescope-browser-check/check.mjs`. 기능 검사 8개는 통과했고 JS 런타임 예외는 없었다. 기존 `/favicon.ico`의 HTTP 404로 전체 브라우저 오류 없음 검사만 실패했다. 임시 스크립트·결과·스크린샷은 Git에서 제외되는 의존성 캐시 안에 두었다.
- `git diff --check`: 공백 오류 없음. 이번 단계는 `main`에 `feat: 가상 포인트 100개 표시와 리소스 정리 추가`로 로컬 commit하고 push는 사용자가 수행한다.

### 두 번째 컴퓨터 환경 복원 (2026-09-08)

- GitHub Desktop 내장 Git으로 `git fetch origin`을 실행하고 현재 `feat/phase-1-three-scene` 브랜치와 원격이 일치하며 작업 폴더가 깨끗함을 확인했다.
- 기존 Node.js `20.15.1`을 winget에서 제공하는 Node.js LTS `24.19.0`으로 업데이트했다. 이전 컴퓨터의 `24.20.0`과 패치 버전은 다르지만 아래 실행 검증을 통과했다.
- npm `11.17.0`과 전역 pnpm `11.24.0`을 확인했다.
- `pnpm install --frozen-lockfile`로 잠금 파일 변경 없이 프로젝트 의존성을 복원했다.
- `pnpm build`의 컴파일, TypeScript 검사와 정적 페이지 생성이 통과했다.
- `pnpm dev` 기동 후 `/`와 `/viewer`의 HTTP 200 및 Viewer의 Canvas 마크업을 확인했다. 실제 GPU 격자 표시와 resize 동작은 브라우저 육안 확인이 남아 있다.
- Phase 2는 시작하지 않았다. 기존 cleanup 이해 확인과 가상 포인트 100개 구현 승인 절차를 이어간다.
- 아래 표는 이전 컴퓨터에서 수행한 Phase 1 검증 기록이다. 개발 서버 실행 여부는 각 컴퓨터에서 별도로 확인한다.

| 검증 | 결과 |
| --- | --- |
| `node --version` | `v24.20.0` |
| `npm --version` | `11.19.0` |
| `pnpm --version` | `11.24.0` |
| `pnpm dev` | Next.js `16.3.3` 개발 서버 기동 성공, `http://localhost:3000`에서 실행 중 |
| `GET http://localhost:3000/` | HTTP `200` |
| `GET http://localhost:3000/viewer` | HTTP `200` |
| 홈과 Viewer 링크 검사 | `/viewer` 링크, `/` 복귀 링크 모두 확인 |
| `/viewer` Canvas 마크업 검사 | `<canvas>`와 CSS Module 클래스, 접근성 이름 확인 |
| 빈 Scene 단계 smoke test | Grid 추가 전 `isScene: true`, `type: Scene`, `children: 0` 확인 |
| `pnpm build` | cleanup 감사 후 컴파일, TypeScript 검사, `/viewer` 정적 페이지 생성 성공 |
| `git ls-remote origin` | `main`과 `feat/phase-1-three-scene` 모두 `8d7c3f2` 확인 |
| 필수 문서 존재 검사 | `AGENTS.md`와 `docs/` 문서 5개 모두 확인 |
| Next.js 관리 블록 검사 | 시작·종료 마커가 각각 1개로 유지됨 |
| PerspectiveCamera 구성 | `fov: 60`, Canvas 종횡비, `near: 0.1`, `far: 1000`, 위치 `(5, 5, 5)`, 원점 주시 확인 |
| WebGLRenderer 구성 | 기존 Canvas 연결, `setSize(..., false)`, rAF 안의 `render(scene, camera)`, cleanup `dispose()` 확인 |
| 자동 브라우저 검사 | browser와 computer-use 스킬의 실제 파일을 찾을 수 없어 렌더 루프·cleanup 육안 검사는 사용자 확인 대기 |
| GridHelper 구성 | `size: 10`, `divisions: 10`, Scene 자식 추가, rAF 렌더와 cleanup `dispose()` 확인 |
| resize 구성 | Camera `aspect`·투영 행렬과 Renderer 크기 갱신, 이벤트 cleanup 확인 |
| rAF 구성 | 최초 예약 1개, 프레임별 다음 예약 1개, 최신 ID 저장과 cleanup 취소 확인 |
| Three.js cleanup 소스 감사 | Grid는 Geometry·Material dispose, Scene은 자식 remove, Renderer는 WebGL 내부 상태·이벤트 정리 확인 |
| 홈·Viewer HTTP 검사 | `/`와 `/viewer` 모두 HTTP 200, 상호 이동 링크 확인 |
| `git fetch origin` | 현재 브랜치와 원격 브랜치가 각각 ahead 0, behind 0으로 충돌 없음 확인 |
| `git check-ignore` | `AGENTS.md`, `CLAUDE.md`, `docs/`가 로컬 전용 규칙과 일치 |
| `git status --short --branch` | Phase 1 commit·push 후 현재 브랜치와 `origin` 동기화 및 깨끗한 worktree 확인 |

## 현재 Git 상태

- 첫 커밋 `8d7c3f2 초기 환경 구성`은 이 프로젝트의 시작 커밋이다.
- 현재 작업 브랜치는 `main`이다. 앞으로 별도 작업 브랜치를 만들지 않고 `main`에서만 작업한다.
- `feat/phase-1-three-scene`의 `c612206`까지 `main`에 포함되어 있으며 별도 커밋은 남아 있지 않다. 현재는 같은 이름의 로컬 브랜치와 원격 브랜치 참조가 모두 남아 있다.
- 병합 직후 `main`의 파일이 기존 Phase 1 브랜치와 동일함을 확인했다. 애플리케이션 코드는 변경하지 않았으며 직전 환경 복원에서 빌드와 HTTP 검증을 통과했다.
- Phase 2의 포인트 10,000개 확장 `1e5f357`, Material 조정 `1c3a44a`, 포인트 수와 FPS 표시 `dd44dbb`까지 사용자가 `origin/main`에 push했다.
- Phase 1 코드와 공유 문서는 `feat/phase-1-three-scene`의 `6048ba1`에 commit하고 `origin`에 push했다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`는 Git에서 추적해 다른 컴퓨터에서도 같은 작업 기준을 사용한다.
- 루트 HTML의 한국어 언어 태그는 올바른 BCP 47 코드인 `ko`를 사용한다.
- 공개 프로젝트 소개용 `README.md`는 추적 가능한 상태로 남긴다.
- 이후 승인된 단계는 구현과 검증을 마칠 때마다 Codex가 `main`에 commit까지만 한다. 사용자가 GitHub Desktop에서 변경을 확인한 뒤 직접 push한다.

## 다음 구현 진입 조건

1. 선택된 Camera·LiDAR·Object Detection Frame을 React UI와 Three.js 장면에 각각 어떻게 반영할지 책임을 나누어 설명하고 사용자 승인을 받는다.

## 추천 커밋 메시지

Phase 1 변경에는 `feat: Viewer Three.js 기본 장면 완성`을 사용했다. 이후에도 각 단계의 검증과 문서 갱신이 끝나면 한글 Conventional Commit을 만들되 push는 사용자가 직접 수행한다.
