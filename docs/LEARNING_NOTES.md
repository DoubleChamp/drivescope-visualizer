# DriveScope 학습 노트

이 문서는 실제로 확인한 개념만 기록한다. 아직 구현하지 않은 Three.js 장면과 공간 데이터 원리는 학습 완료로 표시하지 않는다.

## 현재까지 확인한 내용

### 개발 도구와 프로젝트

- Node.js `v24.20.0`과 pnpm `11.24.0`을 사용할 수 있다.
- Next.js `16.3.3`, React `19.2.8`, TypeScript `5.9.3` 기반 프로젝트가 초기화되었다.
- `pnpm dev`로 개발 서버가 기동되고 `/` 요청이 HTTP 200으로 응답하는 것을 확인했다.
- `pnpm build`가 성공해 production build와 TypeScript 검사가 통과하는 것을 확인했다.

### App Router의 `layout`과 `page`

- `app/layout.tsx`는 하위 페이지를 감싸는 공통 구조다. 현재 루트 HTML의 `<html>`, `<body>`와 metadata를 정의한다.
- `app/page.tsx`는 `/` 경로에서 보이는 페이지 UI를 정의한다.
- `app/viewer/page.tsx` 파일을 만들면 파일 시스템 라우팅으로 `/viewer` 경로가 생긴다.
- `next/link`의 `Link`로 `/`와 `/viewer`를 이동할 수 있으며, 이를 위해 두 페이지 전체를 Client Component로 바꿀 필요는 없다.
- 현재 홈에는 Viewer 이동 링크가 있고 Viewer에는 홈 복귀 링크와 공간 기준 Grid가 있다.

### 서버 렌더링과 브라우저 렌더링

- 서버는 `<canvas>`를 포함한 초기 HTML을 만들 수 있지만 DOM, WebGL 컨텍스트와 GPU가 필요한 `WebGLRenderer`는 만들 수 없다.
- 서버가 초기 WebGL Renderer를 전달하는 것이 아니라, 브라우저가 Client JavaScript를 받은 뒤 Renderer를 직접 만든다.
- hydration은 기존 HTML에 React의 이벤트와 상태 동작을 연결한다. Canvas 내부의 WebGL 픽셀과 Three.js 객체는 hydration 대상 HTML이 아니며 브라우저에서 새로 생성한다.
- 정적인 장면은 `renderer.render()`를 한 번 호출해도 보이므로 `requestAnimationFrame`이 항상 필요한 것은 아니다.
- 계속 움직이는 장면이나 타임라인 재생에는 반복 렌더링이 필요하며, 입력이 있을 때만 다시 그리는 방식도 선택할 수 있다.

### RSC Payload와 hydration

- RSC Payload는 렌더링된 Server Component 트리를 React가 사용할 수 있게 직렬화한 데이터다.
- Server Component의 렌더링 결과, Client Component가 들어갈 자리와 JavaScript 참조, Client Component로 전달할 직렬화 가능한 props를 포함한다.
- 첫 접속에서는 HTML이 초기 화면을 보여주고 RSC Payload가 Server와 Client Component 트리를 맞추며, Client JavaScript가 Client Component를 hydration한다.
- 이후 `Link` 이동에서는 RSC Payload를 이용해 전체 HTML 문서를 새로 읽지 않고 필요한 라우트 내용을 갱신할 수 있다.

### 빈 Canvas와 Client 경계

- `app/viewer/page.tsx`는 제목, 설명과 링크를 담당하는 Server Component로 유지했다.
- `ViewerCanvas`만 `'use client'` 경계로 분리해 앞으로 브라우저 API와 React 생명주기를 다룰 자리를 만들었다.
- `useRef<HTMLCanvasElement>(null)`은 React가 만든 Canvas DOM 객체를 저장할 참조이며, 컴포넌트 render 중에는 `null`일 수 있다.
- CSS Module은 Canvas에만 적용되는 고유한 클래스 이름을 생성한다. 이번 단계에서는 크기와 배경만 지정했다.

### Client 경계의 크기

- 페이지 전체를 Client Component로 만드는 것도 가능하며 첫 접속의 HTML 사전 렌더링도 가능하다.
- 하지만 Client 경계 아래의 import는 브라우저 JavaScript 번들에 포함되고 hydration 대상이 되므로 정적 UI까지 Client로 만들 필요는 없다.
- Client Component에서는 서버 비밀값이나 파일·DB 같은 서버 전용 기능을 직접 사용할 수 없으며, Server Component가 읽은 직렬화 가능한 데이터를 props로 받을 수 있다.

### Three.js Scene

- `Scene`은 Mesh, Line, Light 같은 Three.js 객체를 자식으로 담는 장면 그래프의 최상위 컨테이너다.
- Canvas는 브라우저의 픽셀 표시 표면이고 Scene은 메모리 안의 3D 객체 구조이므로 서로 다른 역할이다.
- `Scene` 자체는 Canvas나 DOM을 필요로 하지 않지만, React 재렌더링마다 다시 만들지 않고 컴포넌트 생명주기와 묶기 위해 `useEffect([])`에서 생성했다.
- 현재 다른 effect나 이벤트가 Scene을 읽지 않으므로 React state나 별도 ref에 저장하지 않고 effect의 지역 변수로 유지한다.
- `scene.clear()`는 Scene의 자식 객체를 분리할 뿐 Geometry, Material, Texture와 GPU 리소스를 `dispose()`하지 않는다.

### PerspectiveCamera

- `PerspectiveCamera`는 가까운 물체가 크게, 먼 물체가 작게 보이는 원근 투영 카메라다.
- 생성자 인자 `fov`는 세로 시야각, `aspect`는 보이는 화면의 가로세로 비율, `near`와 `far`는 렌더링할 최소·최대 거리다.
- 실제 Canvas와 `aspect`가 일치하면 세로 화각은 유지되고 가로 화각이 비율에 맞춰 계산된다. `aspect`가 실제 비율과 다를 때 물체가 가로로 눌리거나 늘어나 보인다.
- 현재 `fov`는 60도, 초기 `aspect`는 마운트 시점 Canvas의 `clientWidth / clientHeight`, `near`는 0.1, `far`는 1000으로 설정했다.
- `camera.position.set(5, 5, 5)`는 카메라 위치를 정하고, `camera.lookAt(0, 0, 0)`은 원점을 향하도록 회전시킨다.
- Camera는 Renderer에 별도 인자로 전달하므로 Scene의 자식으로 추가하지 않아도 된다.
- Camera 자체는 GPU Geometry나 Material을 소유하지 않아 이 단계에서 별도의 `dispose()`가 필요하지 않다.
- 창 크기가 바뀌면 Canvas의 현재 비율로 `aspect`를 다시 설정하고 `updateProjectionMatrix()`로 투영 행렬을 갱신한다.

### WebGLRenderer 연결

- `WebGLRenderer`는 Scene의 객체를 Camera 관점에서 계산하고 WebGL 2를 통해 Canvas의 픽셀로 그린다.
- React가 만든 기존 Canvas를 `new WebGLRenderer({ canvas })`에 전달하므로 Renderer가 별도 Canvas를 만들거나 DOM에 추가하지 않는다.
- Camera의 `aspect`와 Renderer 초기 크기에 같은 `width`와 `height`를 사용한다.
- `renderer.setSize(width, height, false)`의 마지막 `false`는 Canvas의 CSS 크기를 인라인 스타일로 덮어쓰지 않게 한다. 화면상의 CSS 크기는 React가 적용한 CSS Module이 계속 담당한다.
- `renderer.render(scene, camera)`를 한 번 호출하면 현재는 Grid가 포함된 정적인 한 프레임을 그린다.
- 한 번 그린 Canvas의 픽셀은 다음 렌더가 없어도 남아 있다. `requestAnimationFrame`은 픽셀을 유지하기 위한 것이 아니라 장면의 변화를 새 프레임으로 계속 반영할 때 필요하다.
- `renderer.dispose()`는 Renderer의 내부 캐시와 GPU 관련 리소스, Canvas에 연결한 Renderer 관련 이벤트를 정리한다. Canvas DOM 자체는 React 소유이므로 cleanup에서 직접 제거하지 않는다.
- Renderer를 정리해도 장면 객체의 Geometry, Material과 Texture가 자동으로 모두 정리되는 것은 아니므로 해당 리소스의 소유자가 별도로 `dispose()`해야 한다.
- Grid 추가 후 production build와 `/viewer` HTTP 200은 확인했다. 브라우저 검사 스킬의 실제 파일을 찾을 수 없어 WebGL 픽셀의 자동 육안 검사는 아직 수행하지 못했다.

### GridHelper

- `GridHelper(10, 10)`의 첫 번째 값은 Grid의 전체 크기, 두 번째 값은 분할 수이며 한 칸은 1단위다.
- Grid는 원점을 중심으로 `y = 0`인 XZ 평면의 위치·방향·거리 기준을 보여 준다.
- Grid의 선 재질은 조명 계산을 하지 않으므로 Light가 없어도 보인다.
- `scene.clear()`는 Scene에서 자식을 분리하지만 GPU 리소스를 해제하지 않으므로 `grid.dispose()`로 Geometry와 Material을 별도로 정리한다.

### R3F를 사용하지 않는 이유

- R3F는 Three.js 장면을 React JSX와 훅으로 다루기 편하게 해 주는 도구지만 현재 프로젝트의 학습 목표는 Three.js 객체의 생성, 갱신과 정리를 직접 이해하는 것이다.
- DriveScope는 포인트 Buffer와 렌더 루프의 소유권을 직접 다루기 위해 현재도 `@react-three/fiber`를 설치하거나 사용하지 않는다.

### 창 크기 변경 처리

- `window`의 resize 이벤트가 발생하면 Canvas의 `clientWidth`와 `clientHeight`를 다시 읽는다.
- `camera.aspect`는 값만 바꿔서는 실제 투영 행렬이 바뀌지 않으므로 `camera.updateProjectionMatrix()`를 이어서 호출한다.
- `renderer.setSize(width, height, false)`는 새 drawing buffer와 viewport 크기를 반영하고 CSS Module이 정한 표시 크기는 유지한다.
- 연속 렌더 루프가 그리기를 담당하므로 resize 처리는 Camera와 Renderer 크기만 갱신하며 별도의 중복 `render()`를 호출하지 않는다.
- cleanup에서 등록할 때와 같은 함수 참조로 resize 이벤트를 제거한 뒤 Three.js 리소스를 정리한다.

### requestAnimationFrame 렌더 루프

- `requestAnimationFrame()`은 콜백을 다음 화면 갱신 전에 한 번 실행하도록 예약하며, 그 자체가 자동 반복 함수는 아니다.
- `renderFrame`은 `renderer.render(scene, camera)`를 호출한 뒤 다음 animation frame을 하나 다시 예약해 루프를 만든다.
- rAF 콜백은 현재 호출이 끝난 뒤 브라우저가 나중에 새 호출 스택에서 실행하므로 동기 재귀처럼 호출 스택이 쌓이지 않는다.
- 매 예약에서 반환된 ID를 같은 변수에 저장하므로 cleanup 시 아직 실행되지 않은 최신 요청을 취소할 수 있다.
- cleanup은 animation frame과 resize 이벤트를 먼저 차단한 뒤 Grid와 Renderer를 정리해 해제된 Renderer가 다시 호출되지 않게 한다.
- 매 프레임 React state를 변경하지 않고 Three.js 런타임이 Canvas를 직접 렌더링한다.

### JavaScript GC와 Three.js cleanup

- `grid`, `scene`, `camera`와 `renderer` 자체는 JavaScript 객체지만 지역 변수라는 이유만으로 함수 종료 즉시 삭제되는 것은 아니다.
- JavaScript 사양은 변수가 물리적으로 stack이나 heap 어디에 놓이는지 보장하지 않는다. 정확한 기준은 살아 있는 root에서 객체까지 이어지는 참조가 있는지다.
- effect 실행이 끝난 뒤에도 React가 cleanup 함수를, `window`가 이벤트 콜백을, animation frame 큐가 `renderFrame`을 보관할 수 있다. 이 함수들의 closure가 Three.js 객체를 계속 도달 가능한 상태로 만든다.
- 객체끼리 순환 참조한다는 사실만으로 누수가 생기지는 않는다. tracing GC는 외부 root에서 도달할 수 없는 순환 구조도 회수하며, 문제는 `window`나 rAF처럼 살아 있는 host root에서 참조가 이어지는 경우다.
- `dispose()`는 JavaScript 객체를 즉시 삭제하는 명령이 아니다. Three.js와 WebGL에 더 이상 사용하지 않을 리소스임을 알려 GPU Buffer, 프로그램과 내부 캐시를 명시적으로 정리하게 한다.
- `grid.dispose()`는 Grid가 가진 Geometry와 Material을 정리하지만 Grid를 Scene에서 제거하지는 않는다.
- `scene.clear()`는 자식 연결을 끊지만 Geometry와 Material을 정리하지 않는다.
- 현재처럼 Scene 그래프 전체의 외부 참조가 사라지면 GC는 순환 참조가 있어도 JS 객체를 회수할 수 있으므로 `scene.clear()`가 GPU 해제나 GC의 절대 조건은 아니다. 다만 연결을 즉시 명시적으로 끊고 Scene 재사용과 향후 외부 참조에 대비해 유지한다.
- `renderer.dispose()`는 Renderer 내부 리소스와 Canvas의 WebGL context 이벤트를 정리하지만 사용자 Geometry, Material, Texture와 Canvas DOM을 자동으로 제거하지 않는다.
- 외부 콜백과 Three.js 리소스를 명시적으로 정리한 뒤 참조가 사라진 JS 객체는 GC가 나중에 회수한다.
- 탭이나 페이지 실행 영역 자체가 파괴되면 WebGL context도 사라져 브라우저와 GPU 드라이버가 해당 GPU 리소스를 회수한다. SPA 컴포넌트 해제는 탭 종료가 아니므로 같은 `window`와 context가 살아 있는 동안 명시적 cleanup이 필요하다.

### 런타임 패키지와 타입 패키지

- `three`는 브라우저에서 Scene, Camera, Renderer 같은 실제 기능을 실행할 런타임 패키지다.
- `@types/three`는 TypeScript가 Three.js API의 타입을 검사하고 편집기 도움을 제공하게 하는 개발 의존성이다.
- 타입 정보는 검사와 개발에 사용되며 브라우저에서 Three.js 대신 실행되는 코드가 아니다.

### Three.js의 현재 상태

- `three`와 `@types/three`는 설치되어 있다.
- `ViewerCanvas`에서 Three.js `Scene`을 import해 Scene을 생성한다.
- React가 소유하는 빈 Canvas는 만들었다.
- PerspectiveCamera를 만들고 위치, 방향과 투영 범위를 설정했다.
- WebGLRenderer를 기존 Canvas에 연결하고 `requestAnimationFrame` 루프에서 Scene을 렌더링한다.
- `GridHelper(10, 10)`를 Scene에 추가하고 cleanup에서 Grid 리소스를 정리한다.
- 창 resize 처리와 이벤트 cleanup을 구현했다.
- 연속 렌더 루프와 animation frame cleanup을 구현했다.

## 단계별 이해 확인

### 이번 대화에서 확인한 cleanup 이해 (2026-09-08)

- 사용자가 rAF의 다음 예약을 취소해야 이후 콜백이 실행되지 않음을 설명했다.
- 사용자가 살아 있는 콜백의 closure로 객체에 대한 참조가 남으면 GC가 회수하지 못함을 설명했다.
- 사용자가 Scene과 자식의 연결 해제, 그래픽 리소스의 명시적 정리를 구분했다.
- 설명을 보완한 부분: 현재는 WebGLRenderer를 사용하며 `grid.dispose()`는 Geometry뿐 아니라 Material도 정리한다.

### 포인트 100개: 이해 확인 대기

포인트 표시는 구현했지만 다음 원리는 아직 사용자의 설명을 확인하지 않았다. 학습 완료로 표시하지 않는다.

1. 좌표를 담는 Geometry와 색·크기를 정하는 Material을 `Points`가 어떻게 함께 사용하는가?
2. 점 100개를 나타내는 좌표 배열과 Scene에 추가한 `Points` 객체의 수는 어떻게 다른가?
3. 포인트 Geometry와 Material은 언제 생성하고 언제 정리하는가?

## 다음 단계에서 배울 내용

아래 항목은 Phase 2의 예정 내용이며 아직 학습 완료를 확인하지 않았다.

- 가상 포인트 100개의 좌표와 `Points` 구성 원리
- `Vector3` 객체 배열의 구조와 한계, 이후 `Float32Array`와 `BufferAttribute` 연결
