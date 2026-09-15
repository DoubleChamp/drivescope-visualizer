# DriveScope 아키텍처

## 현재 상태

Next.js App Router와 TypeScript가 동작하며 Three.js는 설치되어 있다. `/viewer` 아래에 React가 소유하는 Canvas와 작은 Client Component 경계를 만들고, 컴포넌트가 마운트될 때 Scene, PerspectiveCamera, WebGLRenderer와 `GridHelper(10, 10)`를 생성한다. 창 크기가 바뀌면 Canvas의 CSS 크기를 다시 읽어 Camera의 종횡비와 투영 행렬, Renderer의 drawing buffer를 갱신한다. `requestAnimationFrame` 콜백은 Scene을 렌더링한 뒤 다음 프레임을 하나씩 다시 예약한다. 컴포넌트 해제 시 최신 animation frame과 resize 리스너를 먼저 취소하고 Grid의 Geometry와 Material, Scene과 Renderer를 정리한다.

Phase 2에서는 같은 effect에서 포인트 10,000개의 좌표를 숫자 30,000개인 `Float32Array`에 생성한다. XZ 방향으로 간격 0.1인 100×100 배열을 원점 중심의 `-4.95~4.95` 범위에 놓고 높이는 `y = 0.25`로 고정한다. 좌표 데이터 크기는 120,000바이트다. `BufferAttribute(pointPositions, 3)`가 연속된 숫자 세 개를 한 점의 `x`, `y`, `z`로 해석하고, 이를 `BufferGeometry`의 `position` 속성으로 직접 연결한다. 하나의 `PointsMaterial`에서 모든 점에 공통으로 적용할 색상을 `0x38bdf8`, 크기를 `0.06`으로 지정한다. 기본값인 `sizeAttenuation: true`가 PerspectiveCamera에서 거리에 따라 화면상의 점 크기를 줄인다. 하나의 `Points`가 Geometry와 Material을 묶으며 좌표 Buffer, Geometry와 Material은 마운트할 때 생성하고 기존 렌더 루프에서 재사용한다. cleanup에서는 예약과 이벤트를 차단한 뒤 포인트의 Geometry와 Material도 각각 `dispose()`한다.

이전 `Vector3[]`와 `setFromPoints()` 경로는 좌표를 중간 JavaScript 배열과 새 `Float32Array`로 복사했다. 현재 `BufferAttribute`는 직접 만든 `Float32Array`를 같은 참조로 보관하므로 이 변환 단계를 거치지 않는다.

Scene 순회는 Attribute 배열 전체를 비교하거나 GPU Buffer를 읽어 변경 여부를 찾지 않는다. 애플리케이션이 Attribute의 `needsUpdate`를 `true`로 설정하면 `version`이 증가하고, Renderer가 캐시한 이전 버전보다 클 때만 CPU 배열을 GPU Buffer에 다시 전송한다. 현재 좌표는 생성 뒤 바뀌지 않아 GPU Buffer를 재사용하지만, `renderer.render()`가 실행될 때는 기존 Buffer를 사용한 draw call이 다시 발생한다.

포인트 생성과 화면 표시는 모듈 상수 `POINT_COUNT`를 함께 사용해 실제 Buffer 크기와 표시값이 어긋나지 않게 한다. Three.js rAF 콜백은 지역 변수에 렌더 횟수와 샘플 시작 시각을 보관하고, rAF timestamp의 실제 경과 시간이 1초 이상일 때 `렌더 횟수 × 1000 / 경과 밀리초`로 평균 FPS를 계산한다. React는 포인트 수와 FPS 통계 UI 및 약 1초마다 바뀌는 표시용 FPS state만 소유한다. 이 state로 Client Component가 다시 렌더링돼도 Canvas의 타입과 트리 위치가 같고 effect 의존성 배열이 비어 있어 기존 Canvas, Renderer와 rAF는 유지된다. 별도 interval이 없으므로 컴포넌트 해제 시 기존 `cancelAnimationFrame()`이 렌더링과 측정을 함께 중지한다. 이 값은 rAF 콜백에서 수행한 `renderer.render()` 호출 빈도이며 GPU 명령 하나의 실행 시간을 직접 측정하는 값은 아니다.

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

현재 `VehicleStateFrame`은 실제 상태를 측정한 `timestampMs`, 차량의 `position`과 `yawRadians`, 실제 속도 `speedMetersPerSecond`와 진행 방향 기준 가속도 `accelerationMetersPerSecondSquared`를 보관한다. 가속도는 가속할 때 양수, 속도를 유지할 때 0, 감속할 때 음수로 해석한다.

Trajectory의 예상 위치와 실제 위치를 비교할 때는 `TrajectoryFrame.timestampMs + TrajectoryPoint.offsetMs`로 예상 시각을 구하고, 시나리오 공통 시간축에서 같거나 가장 가까운 `VehicleStateFrame.timestampMs`를 선택한다. 급제동 발생 여부는 물리 상태에 boolean으로 중복 저장하지 않고 별도의 Event로 표현한다.

현재 `ScenarioEvent`는 개별 사건을 구별하는 `id`, 공통 시간축의 발생 시각 `timestampMs`, 사건 종류 `type`을 보관한다. 첫 데모의 `type`은 문자열 유니온인 `"emergency-braking"`만 허용하며 다른 사건이 실제로 필요해질 때 유니온을 확장한다.

Event는 주기적으로 샘플링되는 Vehicle State와 달리 특정 순간에 발생하는 이산 데이터다. 각 상태 Frame에 boolean을 반복 저장하지 않고 독립 Event 스트림으로 관리하면 전체 상태 배열을 검색하거나 중복 여부를 검사하지 않고도 사건 목록, 타임라인 마커와 사건 시점 이동을 처리할 수 있다.

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

- `cancelAnimationFrame()`과 `removeEventListener()`는 브라우저가 보관한 콜백 참조와 이후 실행을 끊는다.
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

`requestAnimationFrame`이 콜백에 전달하는 `timestamp`도 밀리초 단위지만 센서 데이터의 시각은 아니다. 이 값은 브라우저 실행 시계이므로 프레임 사이의 경과 시간을 계산하는 데 사용하고, 그 차이만큼 별도의 시나리오 재생 시간을 전진시킨다.

센서마다 수집 주기가 다르므로 Camera, LiDAR와 Object Detection의 같은 배열 인덱스를 같은 시각으로 간주하지 않는다. 이후 각 센서의 `timestampMs`와 재생 시각의 차이를 비교해 사용할 Frame을 고른다. 원본 Camera·LiDAR Frame은 우선 가장 가까운 Frame을 선택하고, 연속값이 필요한 데이터의 보간 여부는 해당 타입과 동기화 규칙을 정할 때 별도로 판단한다.

## 계획: 시간 동기화 흐름

1. React가 현재 재생 시간을 관리한다.
2. 데이터 계층이 센서별 timestamp에서 해당 시간에 사용할 프레임을 선택한다.
3. 선택된 프레임 데이터로 Three.js 런타임의 기존 객체와 Buffer를 갱신한다.
4. Three.js 렌더 루프가 갱신된 장면을 그린다.

센서별 주기가 다르므로 Camera, LiDAR, Annotation을 하나의 배열 인덱스로 맞추지 않는다. 가장 가까운 프레임의 선택 기준, 허용 시간 차이, 프레임이 없을 때의 처리 방식은 Frame 모델을 설계하는 Phase 3에서 결정한다.

## 계획: Buffer와 캐시

- 포인트 배열과 `BufferAttribute`를 매 프레임 새로 만들지 않고 가능한 범위에서 재사용한다.
- 실제 포인트 수가 바뀔 때의 용량 증가 정책은 측정 후 결정한다.
- 이전·현재·다음 프레임을 우선 캐시하고 주변 프레임을 미리 가져온다.
- 캐시 최대 크기와 축출 기준은 메모리와 로딩 시간을 측정한 뒤 결정한다.
- Worker는 파싱이 병목으로 확인된 경우에만 도입한다.

Buffer 재사용과 프레임 캐시는 Phase 6의 계획이며 현재 구현되지 않았다.

## 단순하게 시작하는 원칙

- 초기에는 하나의 작은 Three.js 장면과 가상 데이터로 시작한다.
- 동작과 책임이 반복해서 확인되기 전에는 범용 렌더러나 복잡한 추상 계층을 만들지 않는다.
- 이해하거나 측정하지 않은 최적화를 먼저 적용하지 않는다.
- 좌표계, Frame 타입, 동기화 허용 오차, 캐시 크기는 해당 학습 단계에서 근거와 함께 결정한다.
