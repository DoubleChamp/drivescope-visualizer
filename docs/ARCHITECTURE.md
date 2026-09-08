# DriveScope 아키텍처

## 현재 상태

Next.js App Router와 TypeScript가 동작하며 Three.js는 설치되어 있다. `/viewer` 아래에 React가 소유하는 Canvas와 작은 Client Component 경계를 만들고, 컴포넌트가 마운트될 때 Scene, PerspectiveCamera, WebGLRenderer와 `GridHelper(10, 10)`를 생성한다. 창 크기가 바뀌면 Canvas의 CSS 크기를 다시 읽어 Camera의 종횡비와 투영 행렬, Renderer의 drawing buffer를 갱신한다. `requestAnimationFrame` 콜백은 Scene을 렌더링한 뒤 다음 프레임을 하나씩 다시 예약한다. 컴포넌트 해제 시 최신 animation frame과 resize 리스너를 먼저 취소하고 Grid의 Geometry와 Material, Scene과 Renderer를 정리한다.

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
