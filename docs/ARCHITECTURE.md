# DriveScope 아키텍처

## 현재 상태

Next.js App Router와 TypeScript가 동작하며 Three.js는 설치되어 있다. `/viewer` 아래에 React가 소유하는 Canvas와 작은 Client Component 경계를 만들고, 컴포넌트가 마운트될 때 Scene, PerspectiveCamera, WebGLRenderer와 `GridHelper(80, 16)`를 생성한다. 창 크기가 바뀌면 Canvas의 CSS 크기를 다시 읽어 Camera의 종횡비와 투영 행렬, Renderer의 drawing buffer를 갱신한다. `requestAnimationFrame` 콜백은 Scene을 렌더링한 뒤 다음 프레임을 하나씩 다시 예약한다. 컴포넌트 해제 시 최신 animation frame과 resize·Canvas click 리스너를 먼저 취소하고 Grid와 런타임이 소유한 Geometry·Material, Scene과 Renderer를 정리한다.

Phase 2에서는 같은 effect에서 포인트 10,000개의 좌표를 숫자 30,000개인 `Float32Array`에 생성한다. XZ 방향으로 간격 0.1인 100×100 배열을 원점 중심의 `-4.95~4.95` 범위에 놓고 높이는 `y = 0.25`로 고정한다. 좌표 데이터 크기는 120,000바이트다. `BufferAttribute(pointPositions, 3)`가 연속된 숫자 세 개를 한 점의 `x`, `y`, `z`로 해석하고, 이를 `BufferGeometry`의 `position` 속성으로 직접 연결한다. 하나의 `PointsMaterial`에서 모든 점에 공통으로 적용할 색상을 `0x38bdf8`, 크기를 `0.06`으로 지정한다. 기본값인 `sizeAttenuation: true`가 PerspectiveCamera에서 거리에 따라 화면상의 점 크기를 줄인다. 하나의 `Points`가 Geometry와 Material을 묶으며 좌표 Buffer, Geometry와 Material은 마운트할 때 생성하고 기존 렌더 루프에서 재사용한다. cleanup에서는 예약과 이벤트를 차단한 뒤 포인트의 Geometry와 Material도 각각 `dispose()`한다.

이전 `Vector3[]`와 `setFromPoints()` 경로는 좌표를 중간 JavaScript 배열과 새 `Float32Array`로 복사했다. 현재 `BufferAttribute`는 직접 만든 `Float32Array`를 같은 참조로 보관하므로 이 변환 단계를 거치지 않는다.

Scene 순회는 Attribute 배열 전체를 비교하거나 GPU Buffer를 읽어 변경 여부를 찾지 않는다. 애플리케이션이 Attribute의 `needsUpdate`를 `true`로 설정하면 `version`이 증가하고, Renderer가 캐시한 이전 버전보다 클 때만 CPU 배열을 GPU Buffer에 다시 전송한다. 현재 좌표는 생성 뒤 바뀌지 않아 GPU Buffer를 재사용하지만, `renderer.render()`가 실행될 때는 기존 Buffer를 사용한 draw call이 다시 발생한다.

현재 LiDAR 런타임은 모든 가상 Frame 중 최대 크기인 숫자 63개, 즉 포인트 21개를 담는 `Float32Array`와 `BufferAttribute`를 마운트 시 한 번만 만든다. 선택된 `LidarFrame`이 바뀌면 그 `positions`를 기존 배열 앞부분에 복사하고 `needsUpdate = true`로 GPU 재전송을 예약한다. `setDrawRange(0, selectedLidarPointCount)`는 최대 Buffer 뒤쪽에 남아 있는 이전 값이나 초기값을 그리지 않게 한다. 이 방식은 Frame마다 Geometry와 GPU Buffer를 새로 만들지 않는다.

좌표를 바꾼 뒤 호출하는 `computeBoundingSphere()`는 GPU 명령이 아니라 브라우저의 JavaScript/CPU에서 `position` Attribute를 읽어 Geometry를 감싸는 구를 다시 계산하는 작업이다. Three.js Renderer는 이 구와 Camera의 frustum을 CPU에서 먼저 비교해 객체 전체가 시야 밖이면 draw call을 생략한다. 통과한 객체의 각 정점 변환과 최종 clipping·rasterization은 그다음 GPU가 담당한다. bounding sphere는 `drawRange`가 아니라 전체 Attribute 용량을 기준으로 계산하므로 뒤쪽 값 때문에 실제 표시 범위보다 커질 수 있지만, 현재 최대 21개인 Buffer에서는 안전한 보수적 판정이고 비용도 작다.

Three.js rAF 콜백은 지역 변수에 렌더 횟수와 샘플 시작 시각을 보관하고, rAF timestamp의 실제 경과 시간이 1초 이상일 때 `렌더 횟수 × 1000 / 경과 밀리초`로 평균 FPS를 계산한다. React는 현재 재생 시간, 재생 여부, 선택된 센서 정보와 약 1초마다 바뀌는 표시용 FPS state를 소유한다. 이 state로 Client Component가 다시 렌더링돼도 Canvas의 타입과 트리 위치가 같고 초기화 effect 의존성 배열이 비어 있어 기존 Canvas, Renderer와 rAF는 유지된다. FPS 측정용 별도 interval은 없으므로 `cancelAnimationFrame()`이 렌더링과 측정을 함께 중지한다. 재생 시계의 `setInterval()`은 별도 effect가 소유하고 정지·해제 시 `clearInterval()`로 정리한다. 표시되는 FPS는 rAF 콜백에서 수행한 `renderer.render()` 호출 빈도이며 GPU 명령 하나의 실행 시간을 직접 측정하는 값은 아니다.

이 문서에서 **계획**으로 표시한 내용은 설계 방향일 뿐 아직 구현된 기능이 아니다.

## 계층별 책임

### React / Next.js

- App Router를 이용한 페이지와 레이아웃 구성
- 타임라인, 재생·정지, 선택 정보 등 화면 UI 구성
- 사용자 입력과 재생 상태 관리
- Three.js가 사용할 `<canvas>` DOM 요소와 컴포넌트 생명주기 제공
- Three.js 런타임의 생성과 정리 시점 연결

매 프레임 바뀌는 포인트 위치나 Three.js 객체 자체를 React state에 저장하지 않는다. React의 렌더링 주기와 Three.js의 렌더 루프를 분리하기 위해서다.

### Three.js 런타임

- React가 제공한 Canvas에 `WebGLRenderer`를 연결하고 렌더링 표면 상태 관리
- `Scene`, `Camera`, 조명·도우미와 시각화 객체 관리
- Geometry, Material, Texture와 GPU Buffer 관리
- `requestAnimationFrame` 렌더 루프 실행
- 크기 변경 반영과 카메라 투영 행렬 갱신
- 컴포넌트 해제 시 렌더 루프 중단 및 GPU 리소스 `dispose`

React Three Fiber는 사용하지 않는다. Three.js 객체의 생성, 변경, 정리를 직접 구현해 각 객체의 소유권과 렌더링 원리를 학습한다.

### 데이터 계층

- Camera, LiDAR, Object Detection, Trajectory, Vehicle State, Event 프레임 타입 정의
- 센서별 timestamp 보관과 특정 재생 시간에 대응하는 프레임 선택
- 가상 시나리오 데이터 제공, 이후 nuScenes mini 데이터로 교체
- 프레임 로딩, 파싱, 캐시와 prefetch 정책 담당
- Three.js가 사용할 수 있는 연속 메모리 형태의 데이터 제공

데이터 계층은 UI 표현이나 Three.js 객체를 직접 소유하지 않는다.

현재 `LidarFrame`은 측정 시점인 `timestampMs`와 `[x, y, z, ...]` 순서의 `Float32Array`인 `positions`만 보관한다. 포인트 수는 중복 필드로 저장하지 않고 `positions.length / 3`으로 계산한다. intensity처럼 아직 사용하지 않는 값은 미리 추가하지 않는다.

`LidarFrame`에는 Three.js의 `BufferAttribute`, `BufferGeometry`나 `Points`를 넣지 않는다. 데이터 계층은 CPU의 순수 좌표를 제공하고, Three.js 런타임이 좌표 해석과 GPU 전송 상태를 관리할 `BufferAttribute`를 소유한다. CPU 배열을 바꾼 뒤에는 Attribute의 `needsUpdate`를 설정해야 다음 `renderer.render()`에서 변경 데이터가 GPU로 전송되고 새 화면에 사용된다.

현재 `CameraFrame`은 촬영 시점인 `timestampMs`와 이미지 위치를 나타내는 문자열 `imageUrl`만 보관한다. 전방 카메라 하나만 다루는 현재 범위에서는 `cameraId`, 이미지 크기와 브라우저 객체를 미리 추가하지 않는다.

`CameraFrame`에는 `HTMLImageElement`, `ImageBitmap`이나 Three.js `Texture`를 넣지 않는다. 직렬화 가능한 URL은 Server Component에서 Client Component로 전달할 수 있으며, React가 카메라 패널의 `<img>` UI를 구성하면 브라우저가 실제 파일을 요청하고 디코딩한다. 향후 3D Texture로 사용할 때만 Three.js 런타임이 Texture 로딩과 `dispose()`를 책임진다.

현재 `ObjectDetectionFrame`은 인식 결과의 `timestampMs`와 같은 시점에 인식된 `ObjectDetection[]`를 보관한다. 각 객체는 프레임 사이에서 같은 대상을 식별할 `id`, 현재 MVP가 다루는 `vehicle | pedestrian` 분류, `confidence`, 3D 박스 중심과 `width, length, height` 크기, 수직축 회전 `yawRadians`를 가진다.

배열 인덱스는 프레임마다 객체 수와 정렬 순서가 달라질 수 있으므로 객체 정체성을 나타내지 않는다. 같은 실제 객체의 `id`는 tracker나 변환 데이터가 프레임 사이에서 유지해 객체 선택과 시간에 따른 추적에 사용한다. 데이터 타입은 숫자와 문자열만 보관하고 Three.js의 Box Geometry나 Object3D는 렌더링 시 Three.js 런타임이 생성·재사용한다.

현재 `TrajectoryFrame`은 Planning이 예측 경로를 생성한 시점인 `timestampMs`와 순서가 있는 `TrajectoryPoint[]`를 보관한다. 각 점의 `offsetMs`는 생성 시점으로부터의 미래 시간 차이이고 `position`은 그 미래 시점에 예상한 차량 위치다. 따라서 한 점의 예상 시각은 `TrajectoryFrame.timestampMs + TrajectoryPoint.offsetMs`다.

DriveScope가 과거 로그를 재생하는 현재 시점에서는 Trajectory 전체가 과거 데이터지만, 각 Frame은 당시 Planning이 바라본 미래 예측의 스냅샷이다. 예측 위치는 같은 시각의 실제 차량 위치가 아니며 이후 `VehicleState`와 비교할 수 있다. Planning이 다시 계산할 때마다 새 `TrajectoryFrame`이 생기므로 급제동 전후 경로 변화를 보존한다.

현재 `TrajectoryFrame`은 내 차량의 Planning 결과만 나타낸다. 관찰한 물체의 과거 이동은 여러 `ObjectDetectionFrame`에서 같은 `id`의 `center`를 timestamp 순서로 연결해 얻고, 관측 속도는 위치와 시간의 차이로 계산할 수 있다. 움직이는 물체의 미래 위치까지 비교해야 할 때는 내 차 Trajectory에 섞지 않고 객체 ID와 미래 offset을 가진 별도 예측 타입을 추가한다. 현재 가상 보행자는 Z 20m에 정지한 것으로 단순화했다.

가상 시나리오의 Trajectory 5개는 실제 Planning 주기를 표현하지 않고 경로가 의미 있게 달라지는 핵심 시점만 남긴 최소 스냅샷이다. 실제 Planning은 더 짧은 주기로 경로를 다시 계산하며, 이 축약 데이터에서는 선택한 Trajectory timestamp와 재생 시각의 차이가 커질 수 있다.

현재 `VehicleStateFrame`은 실제 상태를 측정한 `timestampMs`, 차량의 `position`과 `yawRadians`, 실제 속도 `speedMetersPerSecond`와 진행 방향 기준 가속도 `accelerationMetersPerSecondSquared`를 보관한다. 가속도는 가속할 때 양수, 속도를 유지할 때 0, 감속할 때 음수로 해석한다.

Trajectory의 예상 위치와 실제 위치를 비교할 때는 `TrajectoryFrame.timestampMs + TrajectoryPoint.offsetMs`로 예상 시각을 구하고, 시나리오 공통 시간축에서 같거나 가장 가까운 `VehicleStateFrame.timestampMs`를 선택한다. 급제동 발생 여부는 물리 상태에 boolean으로 중복 저장하지 않고 별도의 Event로 표현한다.

현재 `ScenarioEvent`는 개별 사건을 구별하는 `id`, 공통 시간축의 발생 시각 `timestampMs`, 사건 종류 `type`을 보관한다. 첫 데모의 `type`은 문자열 유니온인 `"emergency-braking"`만 허용하며 다른 사건이 실제로 필요해질 때 유니온을 확장한다.

Event는 주기적으로 샘플링되는 Vehicle State와 달리 특정 순간에 발생하는 이산 데이터다. 각 상태 Frame에 boolean을 반복 저장하지 않고 독립 Event 스트림으로 관리하면 전체 상태 배열을 검색하거나 중복 여부를 검사하지 않고도 사건 목록, 타임라인 마커와 사건 시점 이동을 처리할 수 있다.

`ScenarioData`는 시나리오 `id`와 `durationMs`, Camera·LiDAR·Object Detection·Trajectory·Vehicle State Frame 배열 및 Event 배열을 하나의 데이터 단위로 묶는다. `mockScenario`는 0~15초의 보행자 급제동 장면을 이 타입으로 구현하며 UI나 Three.js 객체를 포함하지 않는다. 가상 카메라 URL은 이후 이미지 패널 단계에서 만들 파일의 경로만 나타낸다.

가상 공간의 단위는 미터이며 X는 좌우, Y는 높이, 양의 Z는 차량 진행 방향으로 사용한다. 모든 가상 위치는 같은 시나리오 좌표계에 있어 Object Detection의 보행자 중심, Trajectory와 Vehicle State를 직접 비교할 수 있다. 실제 nuScenes 데이터는 로딩 경계에서 이 좌표계로 변환한다.

Camera Frame은 1,000ms 간격으로 16개, LiDAR Frame은 500ms 간격으로 31개를 생성해 서로 다른 센서 주기를 표현한다. 10초에 카메라 URL과 LiDAR 포인트에 보행자가 등장하고, Object Detection은 11초부터 같은 `pedestrian-1`을 제공한다. 12초 Trajectory의 2,000ms 뒤 예상 위치 `[0, 0, 20]`은 보행자 중심과 겹친다. 12.4초 급제동 Event와 `-4m/s²` 감속 이후 차량은 13.4초에 Z 15.6m에서 정지하며 이후 Trajectory도 그 위치를 넘지 않는다.

현재 Viewer는 `findLatestFrameAtOrBefore`로 선택한 Camera의 `imageUrl`과 Object Detection의 객체 수·ID를 React 정보 카드에 표시한다. 같은 Camera URL은 전방 카메라 `<img>`의 `src`에도 반영되며 브라우저가 `public/mock-camera/`의 가상 SVG를 요청하고 디코딩한다. 촬영 시각을 함께 표시하며 Camera Frame 주기 사이에서는 최신 과거 이미지를 유지한다. 선택된 LiDAR Frame은 Three.js 포인트 장면에 실제 좌표로 반영되어 10초 전에는 도로 포인트 15개, 이후에는 보행자 포인트를 포함한 21개를 그린다. 선택된 Object Detection의 보행자는 11초부터 3D 박스로 표시한다.

Phase 5의 보행자와 차량 박스는 단위 크기 `BoxGeometry(1, 1, 1)` 하나를 공유한다. 보행자는 주황색, 차량은 초록색이며 조명이 필요 없는 wireframe `MeshBasicMaterial`은 서로 다른 색상을 위해 각각 소유한다. 선택된 Object Detection Frame에서 `category === "pedestrian"`인 객체가 없으면 보행자 Mesh를 숨기고, 있으면 `center`, `size`와 `yawRadians`를 반영한다. 데이터의 `size` 순서 `[width, length, height]`는 Three.js 장면 축 X·Y·Z에 맞춰 `scale(width, height, length)`로 바꾼다.

Canvas click 좌표는 `getBoundingClientRect()`로 구한 CSS 영역 안의 비율로 바꾼 뒤 X는 `비율 × 2 - 1`, Y는 DOM과 WebGL의 증가 방향이 반대이므로 `-(비율 × 2 - 1)`인 NDC로 변환한다. `Raycaster.setFromCamera()`는 Camera 위치에서 이 NDC가 가리키는 3D 방향으로 광선을 만들고, 현재 보이는 보행자 Mesh의 `BoxGeometry` 삼각형 면과 교차하는지 검사한다. wireframe은 그리는 방식이므로 선 사이의 면도 선택 영역이며, Three.js Raycaster는 `visible = false`를 자동으로 제외하지 않아 click handler가 표시 여부를 먼저 검사한다.

선택 상태는 Frame마다 새 참조가 될 수 있는 Detection 객체나 Three.js Mesh 대신 안정적인 `ObjectDetection.id`를 React state에 저장한다. 현재 Mesh의 `userData.objectId`가 최신 Frame의 ID를 보관하므로 마운트 시 만들어진 click handler도 오래된 Frame closure를 읽지 않는다. 같은 ID가 다음 Detection Frame에 있으면 선택을 유지하고, 대상이 사라지거나 빈 공간을 클릭하면 해제한다. Three.js는 기존 보행자 Material의 색만 주황색에서 자홍색으로 바꾸며 Color uniform 값 변경에는 `needsUpdate`가 필요하지 않다. Raycaster와 NDC용 Vector2는 GPU 리소스가 아니므로 `dispose()`하지 않고 Canvas click listener만 cleanup에서 제거한다.

선택 정보 패널은 React가 `selectedObjectId`와 현재 선택된 Object Detection Frame을 대조해 객체를 파생한다. ID만 state에 저장하므로 같은 객체의 새 Frame이 선택되면 confidence·크기·인식 시각은 현재 Frame 값으로 갱신된다. ID가 없거나 현재 Frame에 객체가 없으면 안내 문구를 표시한다. 정보 패널은 Three.js Geometry나 Material을 만들지 않는다.

차량 크기 `[1.8, 4.5, 1.5]`는 Frame마다 변하지 않으므로 각 `VehicleStateFrame`에 반복하지 않고 `ScenarioData.egoVehicleSize`에 한 번 저장한다. Vehicle State의 `position`은 지면 위 차량 footprint 중심을 나타내므로 차량 Mesh의 중심 Y에는 `groundY + height / 2`를 사용한다. 보행자 Detection의 `center`는 이미 3D 박스 중심이어서 같은 보정을 하지 않는다. 두 박스 모두 Y가 수직축이므로 `yawRadians`는 `rotation.y`에 적용한다.

현재 차량 박스는 `findLatestFrameAtOrBefore`로 선택한 Vehicle State의 기록 위치로 즉시 이동한다. 두 Vehicle State 사이의 위치나 yaw 중간값은 아직 계산하지 않으므로 기록 간격 사이에서는 같은 위치를 유지하다 다음 Frame 시각에 이동한다. 이후 보간을 도입한다면 목표 재생 시각이 이전·다음 Frame 사이에서 차지하는 비율로 위치와 yaw를 계산하며, 부드러운 움직임은 그 계산 결과다.

예상 주행 경로도 `findLatestFrameAtOrBefore`로 현재 재생 시각에 이미 생성돼 있던 최신 `TrajectoryFrame`을 선택한다. `timestampMs`는 계획을 생성한 시각이고 각 `TrajectoryPoint.offsetMs`는 그 계획 안의 미래 시간이다. 점의 `position`은 이미 공통 시나리오 좌표계의 절대 위치이므로 선의 좌표를 만들 때 offset을 더하지 않는다. 각 점이 의미하는 예상 시각은 분석할 때 `timestampMs + offsetMs`로 계산한다.

경로 렌더링은 모든 가상 Trajectory 중 최대 4점을 담는 숫자 12개의 `Float32Array`와 `BufferAttribute`, `BufferGeometry`, 노란색 `LineBasicMaterial`과 `Line`을 마운트 시 한 번 생성한다. 선택된 계획이 바뀌면 기존 배열 앞부분에 위치를 복사하고 `needsUpdate = true`로 GPU Buffer 갱신을 예약하며, `drawRange`로 현재 계획의 점 개수만 `LINE_STRIP`으로 그린다. Grid와 같은 높이에서 깊이 충돌이 생기지 않도록 렌더링할 때만 Y에 0.05m를 더하고 원본 데이터는 바꾸지 않는다. 좌표 갱신 뒤 bounding sphere를 다시 계산하고 컴포넌트 해제 시 경로 Geometry와 Material을 명시적으로 정리한다.

서로 다른 `TrajectoryFrame` 사이를 보간하지 않는 이유는 화면을 부드럽게 만드는 대신 플래너가 실제로 출력하지 않은 중간 계획을 만들어 낼 수 있기 때문이다. 12.0초의 기존 계획이 보행자 위치까지 이어지고 12.4초 급제동 시점의 새 계획이 정지 위치에서 끝나는 변화 자체가 분석 대상이다. 과거 계획점의 예상 시각에 실제 Vehicle State를 맞춰 위치 오차를 계산할 수 있지만, 이후 새 계획이 안전하게 갱신됐다면 기존 계획과 실제 위치의 차이를 곧바로 실패로 단정하지 않고 계획 변경 원인과 차량 반응을 함께 본다.

충돌 판정은 현재 가상 시나리오의 차량과 보행자가 모두 `yaw = 0`이고 보행자가 정지해 있다는 조건에서 XZ footprint를 사용한다. `TrajectoryPoint.position`을 차량 footprint 중심으로 보고, 보행자 사각형을 차량 반폭과 반길이만큼 확장한다. 그러면 차량 박스 전체를 경로를 따라 옮기는 대신 차량 중심 선분이 이 확장 영역에 들어오는지 검사해 두 footprint의 겹침을 판정할 수 있다. 현재 보행자 폭·길이 0.6m와 차량 폭 1.8m·길이 4.5m를 합치면 확장 영역은 X `[-1.2, 1.2]`, Z `[17.45, 22.55]`다.

연속한 경로점 두 개를 `P(t) = start + t(end - start)`, `0 <= t <= 1`인 선분으로 표현하고 X·Z 두 축에서 확장 영역 안에 들어오는 `t` 범위를 차례로 좁힌다. 이 slab clipping은 양 끝점이 모두 밖이어도 가운데가 영역을 통과하는 경우를 찾고, 겹치는 부분의 정확한 시작점과 끝점을 반환한다. 12.0초 계획의 마지막 선분은 Z `16 → 20` 중 `17.45 → 20`이 충돌 구간이고, 12.4초 급제동 계획은 최대 Z 15.6에서 끝나므로 충돌 구간이 없다.

전체 예상 경로는 기존 노란 `Line`으로 유지한다. 충돌 구간은 최대 `(경로점 수 - 1) × 2`개 정점을 담는 별도 `Float32Array`, `BufferAttribute`, `BufferGeometry`와 빨간 `LineSegments`를 마운트 시 한 번 만들고 재사용한다. 선택된 Trajectory나 보행자가 바뀔 때 clipped 선분을 Buffer 앞부분에 복사하고 `needsUpdate`, `drawRange`와 bounding sphere를 갱신한다. 빨간 선은 노란 선보다 Y를 0.02m 더 올려 깊이 충돌을 피하고, cleanup에서 Geometry와 Material을 정리한다.

이 판정은 현재 축 정렬 가상 데이터에서 정확하지만 일반적인 곡선 주행 충돌 판정은 아니다. 차량과 객체의 yaw가 서로 다르면 각 미래 시각의 회전 박스(OBB)를 SAT 같은 방법으로 비교해야 하고, Frame 사이의 회전·이동 중 충돌까지 놓치지 않으려면 swept volume이나 연속 충돌 판정이 필요하다. 현재 Trajectory에는 미래 차량 yaw와 움직이는 보행자 예측이 없으므로 이 범위는 구현하지 않는다.

## 소유권과 생명주기

| 대상 | 소유 계층 | 생성 시점 | 정리 시점 |
| --- | --- | --- | --- |
| 페이지, 컨트롤, 재생 상태 | React | 컴포넌트 렌더링 시 | 컴포넌트 해제 시 |
| `<canvas>` DOM 요소 | React | 3D 뷰 렌더링 시 | 3D 뷰 해제 시 |
| Scene, Camera, Renderer | Three.js 런타임 | 3D 뷰 마운트 시 | 3D 뷰 해제 시 |
| Grid와 Geometry, Material, Texture, Buffer | Three.js 런타임 | 시각화 객체 준비 시 | 교체 또는 런타임 해제 시 |
| 센서 프레임과 이벤트 | 데이터 계층 | 데이터 생성·로딩 시 | 캐시 축출 또는 세션 종료 시 |

Three.js 객체는 필요한 경우 React `ref` 또는 React 바깥의 런타임 객체로 참조한다. 같은 리소스를 여러 계층이 임의로 생성하거나 정리하지 않는다.

## GC와 명시적 cleanup

JavaScript GC는 도달할 수 없게 된 JS 객체의 힙 메모리를 나중에 회수한다. 변수의 지역·전역 여부보다 현재 참조 경로가 남아 있는지가 중요하다. `window`의 이벤트 목록과 브라우저의 animation frame 큐가 콜백을 참조하면 콜백의 closure를 통해 Scene, Camera와 Renderer도 계속 도달 가능한 상태로 남을 수 있다.

탭을 닫아 해당 페이지 실행 영역과 WebGL context 자체가 파괴되면 브라우저와 GPU 드라이버가 그 context의 GPU 리소스를 회수한다. 반면 Next.js SPA 안에서 컴포넌트만 해제될 때는 같은 `window`와 WebGL context가 계속 살아 있으므로 탭 종료에 기대지 않고 명시적으로 정리한다.

- `cancelAnimationFrame()`과 resize·Canvas click의 `removeEventListener()`는 브라우저가 보관한 콜백 참조와 이후 실행을 끊는다.
- `grid.dispose()`는 Grid JS 객체를 삭제하지 않고 Geometry와 Material의 dispose 이벤트를 통해 GPU 리소스 해제를 요청한다.
- `scene.clear()`는 Scene과 자식의 참조 관계를 끊지만 GPU 리소스를 해제하지 않는다.
- 현재처럼 Scene 전체가 다른 곳에 보관되지 않고 함께 도달 불가능해진다면 JS GC는 자식 관계가 남아 있어도 그래프 전체를 회수할 수 있다. `scene.clear()`는 즉시 연결을 명시적으로 끊고 이후 Scene 재사용이나 외부 참조가 생겨도 소유권을 분명히 하기 위해 유지한다.
- `renderer.dispose()`는 Renderer 내부 WebGL 캐시와 Canvas context 이벤트를 정리하지만 Canvas DOM이나 사용자 Geometry, Material과 Texture를 자동으로 제거하지 않는다.
- 명시적 cleanup 뒤 남은 JS 객체는 다른 참조가 없어지면 GC 대상이 된다.

## 공통 시간 기준

- 모든 Frame과 Event의 시간 필드 이름은 `timestampMs`로 통일한다.
- 단위는 정수 밀리초이며 가상 시나리오가 시작하는 순간을 `0ms`로 본다.
- 예를 들어 보행자 등장 `10초`는 `10_000ms`, 급제동 `12.4초`는 `12_400ms`로 저장한다.
- 화면에 초 단위로 표시할 때만 `timestampMs / 1_000`으로 변환한다.
- 실제 데이터가 절대 시각이나 더 작은 단위를 사용하면 데이터 로딩 경계에서 시나리오 상대 밀리초로 정규화한다.

`ViewerCanvas`는 현재 재생 시각을 `currentTimeMs` React state로 소유한다. 초기값은 시나리오 시작인 `0ms`이고 전체 길이는 `mockScenario.durationMs`인 `15_000ms`다. 화면에만 `0.0 / 15.0초`처럼 초 단위로 변환해 표시한다. 이 시각에서 Camera·LiDAR·Object Detection Frame을 각각 선택하고 LiDAR Buffer와 보행자 박스를 갱신한다.

재생 여부는 `isPlaying` React state가 소유하고 버튼은 이 값을 `재생`과 `정지` 사이에서 전환한다. 재생을 시작할 때의 시나리오 시간과 브라우저 시각은 화면 렌더링에 필요하지 않으므로 각각 `playbackTimeAtStartRef`와 `playbackStartedAtRef`에 보관한다. 100ms `setInterval`은 UI 갱신 기회만 제공하고 실제 재생 시간은 `재생 시작 시나리오 시간 + (현재 performance.now() - 재생 시작 performance.now())`로 계산한다. 따라서 callback 지연을 고정 `+100ms`로 누적하지 않는다.

정지하면 `isPlaying` 변화에 따른 effect cleanup이 interval을 제거하고 현재 재생 시간은 유지된다. 15초에 도달하면 정확히 시나리오 길이로 제한하고 자동 정지하며, 끝에서 다시 재생하면 0초로 되돌린다. 이 state 변경은 React UI를 다시 렌더링하지만 의존성 배열이 빈 Three.js 초기화 effect를 다시 실행하지 않으므로 기존 Scene, Renderer와 GPU 리소스는 유지된다. 별도 갱신 effect가 선택된 Frame 데이터만 기존 Three.js 객체에 반영한다.

타임라인은 `currentTimeMs`를 `value`로 사용하는 제어된 range input이다. 범위는 `0~mockScenario.durationMs`, 간격은 100ms다. `onChange`에서 `valueAsNumber`를 읽어 문자열 변환 없이 `currentTimeMs`에 반영한다. 사용자가 타임라인을 조작하면 먼저 `isPlaying`을 false로 바꿔 기존 재생 interval이 옛 기준 시각으로 계산한 값으로 seek 결과를 덮어쓰지 않게 한다. 이동한 시각에서 재생 버튼을 누르면 새 재생 기준 ref를 설정하고 이어서 재생한다.

range의 실제 값은 밀리초지만 `aria-valuetext`는 이를 `12.4초`처럼 사람이 이해하기 쉬운 문자열로 접근성 API에 제공한다. 이 값은 화면 표시나 재생 계산을 바꾸지 않으며 `<label>`의 `타임라인` 텍스트와 함께 스크린 리더가 컨트롤의 이름과 현재 값을 이해하게 한다.

타임라인 이벤트 마커의 가로 위치는 `event.timestampMs / mockScenario.durationMs * 100`으로 계산한다. `12_400ms` 급제동 이벤트는 전체 `15_000ms` 중 `82.666…%` 위치에 고정된다. 이벤트 시각과 시나리오 길이에서 다시 만들 수 있는 파생값이므로 별도 React state에 복제하지 않는다. 재생 손잡이는 `currentTimeMs`에 따라 이동하지만 사건 마커는 로그에 기록된 발생 시각을 계속 가리킨다.

현재 마커는 `mockScenario.events`를 순회해 만들며 이벤트 종류와 시각을 화면 문구, `title`과 접근성 이름으로 제공한다. range 손잡이 중심의 실제 이동 구간에 맞도록 마커 레이어의 좌우를 손잡이 반지름만큼 줄이고, `pointer-events: none`으로 두어 마커가 드래그 입력을 막지 않게 한다. 이번 단계의 마커는 탐색 버튼이 아니라 고정된 정보 표시다.

`requestAnimationFrame`이 콜백에 전달하는 `timestamp`도 밀리초 단위지만 센서 데이터의 시각은 아니다. 이 값은 브라우저 실행 시계이므로 프레임 사이의 경과 시간을 계산하는 데 사용하고, 그 차이만큼 별도의 시나리오 재생 시간을 전진시킨다.

센서마다 수집 주기가 다르므로 Camera, LiDAR와 Object Detection의 같은 배열 인덱스를 같은 시각으로 간주하지 않는다. 각 배열에 동일한 `currentTimeMs`를 적용하고 센서별 `timestampMs`를 비교해 사용할 Frame을 독립적으로 고른다. 선택된 Frame 시각이 서로 같아야 동기화된 것이 아니라, 하나의 공통 목표 시각과 명시적인 선택 규칙을 함께 사용하는 것이 동기화다.

`findNearestFrame`은 `timestampMs`가 있는 Frame 배열과 목표 재생 시각을 받아 시간 차이의 절댓값이 가장 작은 원본 Frame을 반환한다. 배열이 비어 있으면 `null`을 반환하며, 이전 Frame과 다음 Frame의 거리가 같으면 미래 데이터를 먼저 선택하지 않도록 더 이른 Frame을 고른다. 현재 가상 데이터는 작으므로 모든 Frame을 한 번 확인하는 `O(n)` 선형 탐색으로 원리를 우선 확인한다. 실제 데이터의 Frame 수와 탐색 비용을 측정해 병목이 확인될 때 정렬된 배열의 이진 탐색을 검토한다.

기본 센서 재생에는 `findLatestFrameAtOrBefore`를 사용해 `timestampMs <= currentTimeMs`인 Frame 중 가장 최신 값을 고른다. 따라서 해당 시점에 아직 획득하지 않은 미래 센서 Frame을 미리 보여 주지 않는다. 선택된 Frame과 재생 시각의 차이인 `frame.timestampMs - currentTimeMs`는 0 또는 음수이며, 음수의 절댓값이 클수록 화면에 표시된 센서 데이터가 오래된 상태임을 뜻한다. 배열이 비었거나 목표 시각 이전의 Frame이 없으면 `null`을 반환한다.

`findNearestFrame`은 그대로 유지한다. Trajectory가 예상한 미래 시각과 이후 실제 Vehicle State처럼 과거와 미래 양쪽 후보 중 시간상 가장 가까운 관측값을 비교할 때 사용할 수 있다. 즉 기본 재생의 인과적 선택과 예측 평가의 최근접 선택은 목적이 다른 정책이다.

Viewer는 Camera, LiDAR와 Object Detection의 선택 결과를 별도 React state에 복제하지 않고 `currentTimeMs`에서 파생한다. 현재 배열은 작으므로 렌더링 중 선형 탐색을 수행한다. 실제 데이터에서 비용이 병목으로 측정될 때만 `currentTimeMs` 기준 `useMemo`와 정렬된 배열의 이진 탐색을 검토하도록 코드에 `TODO`를 남겼다.

## 시간 동기화 흐름

1. React가 현재 재생 시간을 관리한다.
2. 데이터 계층이 센서별 timestamp에서 해당 시간에 사용할 프레임을 선택한다.
3. 선택된 프레임 데이터로 Three.js 런타임의 기존 객체와 Buffer를 갱신한다.
4. Three.js 렌더 루프가 갱신된 장면을 그린다.

센서별 주기가 다르므로 Camera, LiDAR, Annotation을 하나의 배열 인덱스로 맞추지 않는다. 기본 재생 Frame은 `findLatestFrameAtOrBefore`로 선택하고, 예측과 실제값 비교처럼 양쪽 후보가 필요한 분석에는 `findNearestFrame`을 사용한다. 센서별 허용 시간 차이를 넘었을 때 화면을 유지할지 비울지는 실제 데이터 연결 단계에서 정한다.

## 계획: Buffer와 캐시

- 포인트 배열과 `BufferAttribute`를 매 프레임 새로 만들지 않고 가능한 범위에서 재사용한다.
- 실제 포인트 수가 바뀔 때의 용량 증가 정책은 측정 후 결정한다.
- 이전·현재·다음 프레임을 우선 캐시하고 주변 프레임을 미리 가져온다.
- 캐시 최대 크기와 축출 기준은 메모리와 로딩 시간을 측정한 뒤 결정한다.
- Worker는 파싱이 병목으로 확인된 경우에만 도입한다.

LiDAR Buffer 재사용은 Phase 4에서 최소 구조를 먼저 구현했다. 실제 데이터 용량 증가 정책, 프레임 캐시와 prefetch는 Phase 6에서 측정과 함께 구현한다.

## 단순하게 시작하는 원칙

- 초기에는 하나의 작은 Three.js 장면과 가상 데이터로 시작한다.
- 동작과 책임이 반복해서 확인되기 전에는 범용 렌더러나 복잡한 추상 계층을 만들지 않는다.
- 이해하거나 측정하지 않은 최적화를 먼저 적용하지 않는다.
- 좌표계, Frame 타입, 동기화 허용 오차, 캐시 크기는 해당 학습 단계에서 근거와 함께 결정한다.
