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
- Canvas의 `id`는 DOM을 찾기 위한 식별자일 뿐 React의 재사용 여부를 정하지 않는다. React는 같은 컴포넌트 타입과 렌더 트리 위치, `key`를 기준으로 기존 Canvas를 재사용하며 컴포넌트가 해제되거나 `key`가 바뀌면 같은 `id`여도 새 Canvas를 만든다.
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

### 포인트 100개 구성 이해 확인 (2026-09-13)

- 사용자가 `Vector3` 좌표, Geometry, Material과 Scene에 추가하는 렌더링 객체의 역할을 구분해 설명했다.
- `Points` 하나가 Geometry의 좌표 100개와 하나의 Material을 묶어 점 100개를 그린다. `Points`는 Mesh와 비슷하게 Geometry와 Material을 결합하는 `Object3D`지만 점 렌더링 전용 객체다.
- 현재 `PointsMaterial`은 모든 점의 색과 크기를 정한다. Texture는 선택적인 `map`을 지정할 때만 사용한다.
- Geometry와 Material은 effect setup에서 한 번 만들고 렌더 루프에서 재사용하며, 컴포넌트가 해제될 때 각각 `dispose()`한다.

### `Vector3` 객체 배열 구조와 한계 확인 (2026-09-13)

- 직전 구현의 좌표 데이터는 배열 1개와 `x`, `y`, `z` 프로퍼티를 가진 `Vector3` 객체 100개로 시작했다.
- 설치된 Three.js `0.185.1`의 `setFromPoints()`는 각 객체의 세 좌표를 중간 JavaScript 배열에 복사하고, 다시 `Float32Array` 기반의 `Float32BufferAttribute`로 변환한다.
- 런타임 검사에서 포인트 100개가 `itemSize: 3`, `count: 100`, 숫자 300개인 `Float32BufferAttribute`로 만들어짐을 확인했다.
- Geometry는 입력한 `Vector3[]`를 계속 참조하지 않는다. 변환 뒤 원본 `Vector3`의 값을 바꿔도 Geometry의 위치 값은 함께 바뀌지 않는 것을 런타임에서 확인했다.
- 포인트 100개를 마운트할 때 한 번 만들던 직전 코드에서는 객체 생성과 복사 비용이 작고 `Vector3`의 계산 API가 편리했다. 포인트 수가 크거나 매 Frame 반복하면 점마다 객체를 만들고 다시 연속 배열로 복사하는 과정이 할당량과 GC 부담을 늘릴 수 있다.
- 사용자가 Geometry에는 변환된 좌표가 복사되어 원본 `Vector3` 수정이 자동 반영되지 않는 점과, 큰 객체 배열에서는 객체 할당과 반복 변환의 부담이 커질 수 있음을 설명했다.

### 한 점 갱신과 프레임 다시 그리기 (2026-09-13)

- 직전 구현에서도 `setFromPoints()`는 effect setup에서 한 번만 실행됐다. 현재 rAF 콜백도 기존 Scene과 GPU Buffer를 사용해 `renderer.render()`만 호출하므로 Geometry를 매 프레임 다시 만들거나 좌표를 다시 계산하지 않는다.
- 한 점을 움직일 때는 기존 위치 배열에서 그 점의 `x`, `y`, `z` 세 요소만 바꿀 수 있다. 현재 Three.js에서는 `addUpdateRange(i * 3, 3)`와 `needsUpdate = true`를 사용하면 GPU에도 해당 `Float32` 세 개, 즉 12바이트 범위만 갱신할 수 있다.
- 데이터 일부만 갱신하는 것과 새 화면을 그리는 것은 별개다. 기본 Renderer는 프레임을 지운 뒤 하나의 `Points` draw call로 모든 점을 다시 처리하지만, 바뀌지 않은 9,999개의 좌표 데이터를 JavaScript에서 다시 계산하거나 GPU에 다시 올릴 필요는 없다.
- Scene 순회는 Attribute의 모든 숫자나 GPU 메모리를 비교하지 않는다. `needsUpdate = true`가 Attribute의 `version`을 올리고, Renderer는 자신이 캐시한 버전과 비교해 더 새로운 경우에만 GPU 전송을 수행한다. 배열만 수정하고 `needsUpdate`를 설정하지 않으면 GPU에는 이전 값이 남는다.
- 움직이는 한 점을 별도 `Points`로 나누면 객체와 draw call이 하나 늘어난다. 정적 장면 캐시처럼 다른 전략과 함께 쓰지 않는 한 더 빠르다고 단정할 수 없으므로 실제 데이터에서 측정한 뒤 결정한다.

### `Float32Array` 좌표 구조 확인 (2026-09-13)

- 포인트 100개의 세 좌표를 저장하려면 `new Float32Array(100 * 3)`으로 숫자 슬롯 300개를 먼저 확보한다.
- 각 요소는 4바이트이므로 좌표 데이터 자체의 `byteLength`는 1,200바이트다. 객체별 부가 정보 없이 같은 형식의 숫자가 연속된 슬롯에 놓인다.
- 포인트 인덱스가 `i`이면 `x`, `y`, `z`는 각각 `i * 3`, `i * 3 + 1`, `i * 3 + 2`에 저장한다.
- 런타임 검사에서 37번 포인트가 111, 112, 113번 슬롯을 사용하며, 세 슬롯만 수정했을 때 바로 앞 포인트의 값은 바뀌지 않음을 확인했다.
- `Float32Array`는 생성할 때 정한 길이가 고정되고 일반 배열의 `push()`가 없다. 더 많은 점이 필요하면 더 큰 배열을 만들거나 미리 정한 여유 용량을 관리해야 한다.
- 메모리 배치를 확인한 뒤 같은 배열을 Three.js `BufferAttribute`에 직접 연결했다.

### `Float32Array`와 `BufferAttribute` 직접 연결 (2026-09-13)

- `ViewerCanvas`에서 `Vector3` import와 객체 배열, `setFromPoints()`를 제거했다.
- 포인트 100개의 좌표를 `Float32Array(300)`에 직접 채우고 `new BufferAttribute(pointPositions, 3)`으로 감쌌다.
- `itemSize` 3은 연속된 숫자 세 개를 하나의 정점 좌표로 해석하게 하므로 Attribute의 `count`는 100이 된다.
- Geometry의 `position` 속성은 각 정점의 공간 좌표를 나타내는 이름이며 `pointsGeometry.setAttribute("position", attribute)`로 연결한다.
- 현재 Three.js의 기본 `BufferAttribute`는 전달한 `Float32Array`를 복사하지 않고 같은 배열을 참조한다. 런타임에서 Attribute의 `array`와 입력 배열이 동일하며 `count: 100`, `byteLength: 1200`임을 확인했다.
- 이전 `setFromPoints()` 결과와 새 배열의 숫자 300개를 비교해 불일치가 0개임을 확인했다. 포인트의 화면 배치 데이터는 이전과 같다.
- Geometry와 Material의 소유권은 바뀌지 않았으므로 기존 effect cleanup에서 계속 각각 `dispose()`한다.

### 포인트 10,000개 확장 (2026-09-14)

- 한 변의 점 수를 100으로 두면 `100 * 100`으로 총 10,000개가 된다. 각 점이 `x`, `y`, `z` 세 값을 사용하므로 위치 배열은 `Float32Array(30_000)`이다.
- `Float32` 한 요소는 4바이트이므로 위치 데이터 자체는 `30,000 * 4 = 120,000`바이트다. 런타임에서 `length: 30000`, `byteLength: 120000`을 확인했다.
- `pointIndex = row * 100 + column`으로 2차원 행과 열을 하나의 점 인덱스로 바꾸고, `offset = pointIndex * 3`부터 세 좌표를 저장한다.
- 점 간격 0.1과 중심 보정값 4.95를 사용해 첫 점과 마지막 점을 XZ 방향의 약 `-4.95`와 `4.95`에 놓았다. 100×100 점이 크기 10인 Grid 범위 안을 채운다.
- 점 수가 100배가 되어도 점 객체 10,000개를 만들지 않는다. 위치 배열 하나, `BufferAttribute` 하나, `BufferGeometry` 하나와 `Points` 하나를 계속 사용하며 Attribute의 `count`만 10,000이 된다.
- 점 개수 변화만 분리해 확인한 단계에서는 `PointsMaterial`의 색상과 크기 0.1을 유지했고, 다음 항목에서 Material만 별도로 조정했다.
- 사용자가 10,000개 점마다 `x`, `y`, `z` 세 값이 있고 `Float32` 한 요소가 4바이트이므로 `10,000 * 3 * 4 = 120,000`바이트가 됨을 설명했다. `Float32`는 값이 소수인지와 관계없이 항상 4바이트다.
- 사용자가 하나의 `Points`가 모든 좌표를 가진 Geometry를 참조하므로 점마다 `Points` 객체를 만들 필요가 없음을 설명했다. 정확히는 `Points → BufferGeometry → position BufferAttribute → Float32Array` 순서로 참조한다.
- `halfExtent`는 점 개수가 아니라 첫 점과 마지막 점 사이의 간격 수인 `pointsPerSide - 1`에 간격을 곱한 뒤 절반으로 나눈 값이다. 100개 점은 99개 간격이라 전체 폭이 9.9이고, 그 절반인 4.95를 빼면 양 끝이 `-4.95`와 `+4.95`가 된다.
- 한 축의 점 개수가 짝수면 원점에 점이 놓이지 않고 가운데 두 점 `-0.05`, `+0.05` 사이가 원점이 된다. 원점에도 점을 놓으며 대칭을 유지하려면 101개처럼 홀수를 사용한다.

### `PointsMaterial` 색상과 크기 조정 (2026-09-14)

- `Points` 하나가 Geometry와 Material 하나를 참조하므로 Material의 `color`와 `size`는 10,000개 점 모두에 공통으로 적용된다. 점마다 다른 색이 필요할 때는 별도의 color Attribute와 `vertexColors` 설정이 필요하다.
- 색상을 기존 노란색 `0xffc857`에서 어두운 배경과 회색 Grid에 구분되는 밝은 청록색 `0x38bdf8`로 바꿨다. `PointsMaterial`은 조명 계산 없이 이 색상을 출력한다.
- 크기를 기존 `0.1`에서 `0.06`으로 줄였다. 이는 0.1 간격의 조밀한 점이 면처럼 뭉치지 않게 하기 위한 시작값이며 실제 화면 픽셀 크기는 카메라 거리와 drawing buffer 크기의 영향도 받는다.
- `sizeAttenuation`은 기본값이 `true`다. PerspectiveCamera에서는 vertex shader가 카메라 공간의 깊이를 사용하므로 가까운 점이 더 크게, 먼 점이 더 작게 보인다.
- Material만 바꿨으므로 위치 배열과 `BufferAttribute`를 다시 만들지 않았고 점 개수도 10,000개로 유지된다. cleanup에서는 같은 `pointsMaterial.dispose()`가 GPU 관련 Material 리소스 정리를 맡는다.
- 런타임 검사에서 `color: 0x38bdf8`, `size: 0.06`, `sizeAttenuation: true`, `vertexColors: false`, `map: null`을 확인했다.
- 사용자가 `Points`는 Mesh와 비슷하게 Geometry와 Material을 묶는 하나의 렌더링 객체지만 삼각형이 아닌 점 primitive를 사용한다는 원리를 설명했다.
- 위치는 vertex shader 실행마다 Buffer에서 다르게 읽는 Attribute이고 현재 Material의 색상과 크기는 모든 실행이 공유하는 uniform이므로 10,000개 점에 함께 적용된다.
- 사용자가 거리 감쇠는 WebGL draw call 뒤 GPU vertex shader가 각 점의 카메라 공간 깊이로 `gl_PointSize`를 계산하는 과정이며, 점 사이 값을 섞는 보간이 아님을 설명했다.

### 포인트 수와 FPS 표시 (2026-09-14~15)

- 포인트 배열 생성과 UI가 모듈 상수 `POINT_COUNT`를 함께 사용한다. 포인트 수를 바꿀 때 Buffer 크기와 화면 숫자를 따로 수정해 어긋나는 일을 막는다.
- 기존 rAF 콜백이 `renderer.render()`를 호출한 횟수를 세고, rAF timestamp로 측정한 실제 경과 시간이 1초 이상이면 `렌더 횟수 * 1,000 / 경과 밀리초`를 반올림해 FPS를 구한다. 정확히 1초에 콜백이 오지 않아도 실제 경과 시간으로 보정한다.
- 첫 rAF timestamp는 샘플 시작 시각으로만 저장한다. 이후 60Hz timestamp 60개가 1초에 걸쳐 들어오면 60 FPS, 30Hz timestamp 30개면 30 FPS가 되는 것을 계산 검사로 확인했다.
- 렌더 횟수와 시간은 effect의 지역 변수라 매 프레임 React 렌더링을 일으키지 않는다. 계산된 표시값만 약 1초에 한 번 `framesPerSecond` state에 넣는다.
- FPS state가 바뀌면 Client Component의 통계 글자는 다시 렌더링되지만 Canvas는 같은 타입과 트리 위치에 있어 재사용된다. effect의 의존성 배열도 비어 있으므로 Scene, Renderer와 rAF를 다시 만들지 않는다.
- FPS 측정 자체에는 별도 `setInterval`을 사용하지 않아 최신 rAF 요청을 취소하면 렌더와 측정이 함께 멈춘다. 이후 추가된 재생 시계의 interval은 별도 effect와 cleanup이 관리한다.
- 표시되는 값은 rAF에서 실행한 렌더 호출 빈도의 1초 평균이다. 모니터 주사율, 브라우저 스케줄링, 비활성 탭, CPU와 GPU 부하의 영향을 받으며 GPU 명령 하나의 실행 시간을 직접 나타내지는 않는다.
- 통계 UI는 첫 샘플 전 `측정 중`을 보여 주고 이후 숫자를 표시한다. 매초 스크린리더 알림이 반복되지 않도록 live region은 사용하지 않는다.
- 사용자가 실제 화면에서 `측정 중`이 60 FPS로 바뀌는 것을 확인했다. 또한 rAF timestamp가 밀리초 단위이고 `렌더 횟수 * 1,000 / 실제 경과 밀리초`가 1초 기준 평균 FPS가 되는 이유를 설명했다.
- 사용자가 렌더 횟수와 경과 시간은 effect 지역 변수로 누적하고, 계산된 표시값만 약 1초마다 React state에 넣어 불필요한 매 프레임 React 렌더링을 피하는 구조를 설명했다.
- `POINTS_PER_SIDE`를 10과 100으로 바꿔 포인트 100개와 10,000개를 각각 확인했으며 둘 다 60 FPS였다. 이는 두 경우 모두 현재 모니터 주사율과 rAF의 약 16.7ms 프레임 예산 안에 들어왔다는 뜻이며 실제 CPU·GPU 작업량이 같다는 증거는 아니다.
- `POINTS_PER_SIDE`는 실행 중 상태가 아닌 모듈 상수다. 이번 비교는 저장 후 각 크기의 Geometry를 새로 만든 정상 상태 렌더링을 비교하며, 동적 Buffer 크기 변경이나 일부 좌표 갱신 성능을 시험하지 않는다.

### 공통 timestamp 단위와 기준 시점 (2026-09-15)

- 모든 Frame과 Event의 시간 필드 이름은 `timestampMs`로 통일한다.
- 가상 시나리오 시작을 `0ms`로 두고 내부 시간은 정수 밀리초로 저장한다. `12.4초`는 `12_400ms`이며 화면에 표시할 때만 `1_000`으로 나눈다.
- 공통 시간 규격을 사용하면 서로 다른 종류의 데이터를 같은 방식으로 비교, 정렬하고 재생할 수 있다.
- rAF 콜백의 `timestamp`는 브라우저 실행 시계다. 센서 데이터의 `timestampMs`로 직접 쓰지 않고 프레임 사이의 실제 경과 시간을 구해 시나리오 재생 시간을 전진시키는 데 사용한다.
- Camera, LiDAR와 Object Detection은 수집 주기가 다르므로 같은 배열 인덱스가 같은 시각을 의미하지 않는다. 재생 시각과 각 Frame의 `timestampMs` 차이를 비교해 사용할 Frame을 선택해야 한다.
- 원본 이미지와 포인트클라우드는 항상 보간할 필요가 없다. 우선 가장 가까운 Frame을 선택하고, 차량 상태처럼 연속값이 필요한 데이터만 별도의 보간 규칙을 검토한다.
- 사용자가 데이터 규격을 맞추면 사용하기 편해지고, 센서별 주기가 달라 배열 인덱스로 시계열을 동기화할 수 없음을 설명했다.

### LiDAR Frame 타입 (2026-09-15)

- `LidarFrame`은 측정 시점인 `timestampMs`와 포인트 좌표인 `positions`를 가진다.
- `positions`는 `[x, y, z, x, y, z, ...]` 순서의 `Float32Array`다. 포인트 수는 `positions.length / 3`으로 구하므로 별도 필드를 중복 저장하지 않는다.
- `Float32Array`는 Geometry 자체가 아니라 Geometry에 연결할 CPU 쪽 연속 좌표 데이터다.
- 데이터 계층에는 Three.js의 `BufferAttribute`를 넣지 않는다. 같은 LiDAR 데이터를 파싱, 캐시하거나 Worker로 전달하는 과정이 렌더링 라이브러리에 종속되지 않게 하기 위해서다.
- Three.js 런타임은 Frame의 좌표를 `itemSize: 3`인 `BufferAttribute`로 해석하고 Geometry에 연결한다.
- CPU의 `Float32Array` 값을 바꿔도 GPU는 변경을 자동 감지하지 않는다. Attribute의 `needsUpdate = true`로 버전을 올려야 다음 렌더 때 Renderer가 새 데이터를 GPU로 전송한다.
- GPU Buffer가 갱신돼도 새 픽셀을 보려면 `renderer.render()`가 다시 실행돼야 한다. 현재는 rAF가 다음 렌더를 예약하므로 별도 호출이 필요 없지만 정적 1회 렌더 방식에서는 직접 다시 호출해야 한다.
- 사용자가 CPU 배열의 변경을 GPU가 알 수 없으므로 `needsUpdate`가 필요하며 이후 렌더도 실행돼야 한다고 설명했다.

### Camera Frame 타입 (2026-09-15)

- `CameraFrame`은 촬영 시점인 `timestampMs`와 이미지 위치 문자열 `imageUrl`을 가진다.
- URL 문자열은 직렬화할 수 있으므로 Server Component에서 Client Component로 props를 통해 전달할 수 있다.
- Frame 데이터에는 `HTMLImageElement`, `ImageBitmap`이나 Three.js `Texture`처럼 특정 실행·렌더링 환경에 속한 객체를 넣지 않는다.
- 현재 MVP의 전방 카메라 패널은 React가 `<img>` UI를 구성하고 브라우저가 URL의 실제 파일 요청과 디코딩을 담당한다.
- 향후 같은 이미지를 3D Texture로 사용한다면 Three.js 런타임이 Texture를 만들고 교체·해제 시 `dispose()`한다. 이 경우에도 `CameraFrame`은 URL만 제공한다.
- 사용자가 URL 문자열을 Server Component에서 Client Component로 단방향 전달할 수 있고 실제 이미지는 렌더링 계층에서 로딩한다고 설명했다.

### Object Detection 타입 (2026-09-15)

- `ObjectDetectionFrame`은 인식 결과가 생성된 `timestampMs`와 같은 시점에 인식된 `ObjectDetection[]`를 묶는다. 한 시점에 객체가 없거나 여러 개일 수 있다.
- 개별 `ObjectDetection`은 `id`, `vehicle | pedestrian` 분류, `confidence`, 3D 박스 중심 `center`, `width, length, height` 크기와 수직축 회전 `yawRadians`를 가진다.
- `center`와 `size`는 각 숫자의 순서를 타입 편집기에 표시하는 named tuple이다. 실행 시에는 일반 숫자 배열이며 TypeScript가 순서의 의미를 알려 준다.
- `confidence`는 숫자 타입만으로 `0~1` 범위를 강제하지 못한다. 실제 외부 데이터를 연결할 때 파싱 경계의 런타임 검증이 별도로 필요하다.
- 프레임마다 객체 수와 배열 정렬 순서는 달라질 수 있으므로 배열 인덱스를 객체 식별자로 사용할 수 없다.
- 같은 실제 객체의 `id`는 tracker나 데이터셋 instance ID가 프레임 사이에서 유지해야 객체 선택과 시간에 따른 추적에 사용할 수 있다.
- 데이터 타입에는 Three.js Box Geometry나 Object3D를 넣지 않는다. Three.js 런타임이 숫자 데이터를 받아 렌더링 객체를 생성하고 이후 재사용·정리한다.
- 사용자가 `ObjectDetectionFrame`은 한 Frame의 여러 객체를 묶고, 같은 실제 차량은 이전·현재 Frame에서 같은 ID를 가져야 한다고 설명했다.

### Trajectory 타입 (2026-09-15)

- `TrajectoryFrame.timestampMs`는 Planning이 해당 예상 경로를 생성한 시점이다.
- `TrajectoryPoint.offsetMs`는 경로 생성 시점에서 얼마나 미래인지 나타내고, `position`은 그 미래 시점에 예상한 차량 위치다.
- 경로 점의 예상 시각은 `TrajectoryFrame.timestampMs + TrajectoryPoint.offsetMs`로 구한다. 같은 Frame 안에서는 `offsetMs`가 작은 점부터 시간순으로 둔다.
- 현재 시점에서 과거 로그를 재생하더라도 각 Trajectory는 당시 Planning이 바라본 미래 예측 스냅샷이다.
- 예측 `position`은 실제 차량 위치가 아니다. 이후 같은 시각의 `VehicleState`와 비교하면 예측과 실제 움직임의 차이를 분석할 수 있다.
- Planning이 경로를 다시 계산하면 새 `TrajectoryFrame`이 생기므로 급제동 전후에 예상 경로가 어떻게 바뀌었는지 시간축에서 비교할 수 있다.
- 사용자가 과거 데이터를 재생하면서도 당시 AI가 판단을 위해 예측한 미래 경로를 보존하려고 `offsetMs`와 예상 위치를 둔다고 설명했다.

### Vehicle State 타입 (2026-09-15)

- `VehicleStateFrame`은 실제 상태가 측정된 `timestampMs`, 차량의 `position`, `yawRadians`, `speedMetersPerSecond`와 `accelerationMetersPerSecondSquared`를 가진다.
- 가속도는 차량 진행 방향 기준의 부호 있는 값이다. 양수는 가속, 0은 속도 유지, 음수는 감속으로 해석한다.
- Trajectory는 과거 당시의 미래 예측이고 Vehicle State는 해당 시각에 실제로 관측된 값이므로 서로 다른 데이터다.
- Trajectory 점의 예상 시각은 `TrajectoryFrame.timestampMs + TrajectoryPoint.offsetMs`다. 이 시각과 같거나 가장 가까운 `VehicleStateFrame.timestampMs`의 실제 위치를 비교한다.
- 여기서 공통 시간축은 Unix epoch가 아니라 시나리오 시작을 `0ms`로 둔 상대 시간축이다.
- 급제동 여부는 실제 속도·가속도와 성격이 다른 사건이다. 상태에 boolean으로 중복 저장하지 않고 다음 단계의 Event 타입에서 발생 시각과 함께 표현한다.
- 사용자가 사건은 Event 타입에서 독립 관리하고 Trajectory 예상 시각과 Vehicle State 측정 시각을 공통 시간축에서 비교해야 한다고 설명했다.

### Event 타입 (2026-09-15)

- `ScenarioEvent`는 사건을 구별하는 `id`, 공통 시간축의 발생 시각 `timestampMs`, 사건 종류 `type`을 가진다.
- 현재 `type`은 첫 데모에 필요한 `"emergency-braking"`만 허용한다. 다른 사건이 실제로 필요해질 때 문자열 유니온에 종류를 추가한다.
- Event는 일정한 주기로 쌓이는 상태 Frame이 아니라 특정 순간에 발생하는 이산 데이터다.
- Vehicle State마다 사건 boolean을 반복 저장하지 않고 독립 Event 스트림으로 관리하면 전체 상태 배열을 하나씩 검색하거나 중복 여부를 확인하지 않고도 사건 목록과 타임라인 마커를 처리할 수 있다.
- 사용자가 독립 Event 스트림은 사건 조회와 중복 관리가 쉽고 마커도 독립적으로 확인하기 좋다고 설명했다.

### 가상 급제동 시나리오 데이터 (2026-09-15)

- `ScenarioData`는 시나리오 `id`, `durationMs`와 Camera·LiDAR·Object Detection·Trajectory·Vehicle State Frame 및 Event 배열을 하나로 묶는다.
- `mockScenario`는 0~15초를 표현한다. Camera는 1,000ms 간격으로 16개, LiDAR는 500ms 간격으로 31개라서 두 배열의 같은 인덱스가 같은 시각을 나타내지 않는다.
- 가상 좌표는 미터 단위이며 X는 좌우, Y는 높이, 양의 Z는 차량 진행 방향이다. 서로 비교할 위치는 모두 같은 시나리오 좌표계를 사용한다.
- 10초에 원본 카메라·LiDAR 데이터에 보행자가 등장하고, 11초부터 Object Detection에 안정적인 `pedestrian-1` ID로 나타난다.
- 12초에 생성한 Trajectory의 `offsetMs: 2_000`인 점은 예상 시각 14초와 위치 `[0, 0, 20]`을 뜻한다. 이 위치는 보행자 중심과 같아 충돌 예상 상태가 된다.
- 12.4초에 급제동 Event와 `-4m/s²` 감속이 시작되고 실제 차량은 13.4초에 Z 15.6m에서 정지한다. 급제동 후 Trajectory도 정지 위치를 넘지 않는다.
- 사용자가 재생 시각 12,400ms에서 Camera와 LiDAR의 같은 배열 인덱스를 사용하지 않고, 각 스트림의 `timestampMs`를 재생 시각과 비교해 Frame을 따로 선택해야 한다고 설명했다.
- 현재 Trajectory는 내 차량이 앞으로 어떻게 움직일지 정한 Planning 결과다. 관찰한 물체의 이동 히스토리는 같은 객체 ID의 Detection 위치를 시간순으로 연결하고, 관측 속도는 위치 변화량을 시간 변화량으로 나눠 구할 수 있다.
- 움직이는 물체의 미래 경로가 필요하면 내 차 Trajectory에 섞지 않고 객체 ID와 미래 offset을 가진 별도 예측 데이터로 표현한다. 실제 충돌 분석은 같은 미래 시각의 내 차 계획 위치와 물체 예상 위치를 비교해야 한다.
- 현재 Trajectory 5개는 실제 Planning 주기가 아니라 중요 장면만 남긴 최소 스냅샷이다. 0초 다음이 10초라서 중간 재생 시각에는 오래된 경로가 선택될 수 있으며, 실제 Planning은 더 짧은 주기로 경로를 다시 계산한다.

### 현재 재생 시간 React state (2026-09-16)

- `currentTimeMs`는 시나리오의 현재 재생 위치이며 Frame과 Event가 사용하는 것과 같은 정수 밀리초 단위를 사용한다.
- 초기값은 시나리오 시작인 `0ms`이고 전체 길이는 `mockScenario.durationMs`인 `15_000ms`다.
- 화면에 표시할 때만 두 값을 `1_000`으로 나누고 소수점 한 자리로 만들어 `0.0 / 15.0초`로 보여 준다.
- 재생 시간은 이후 버튼, 타임라인과 재생 흐름이 변경하고 화면에도 표시해야 하므로 React state가 소유한다. Three.js는 선택된 시점의 데이터를 받아 그리는 역할을 맡는다.
- 현재 단계는 state의 초기값과 표시만 구현했으며 setter를 사용하는 재생 동작과 Frame 선택은 아직 없다.
- 사용자가 시간축 변경을 화면에 보여 주기 위해 `currentTimeMs`를 state로 관리한다고 설명했다.

### 실제 경과 시간 기반 재생과 정지 (2026-09-16)

- `isPlaying`은 재생 중인지 나타내는 React state다. 이 값이 true일 때만 재생 effect가 interval을 만들고 false가 되면 cleanup에서 제거한다.
- `setInterval(100)`은 정확히 100ms마다 실행된다는 보장이 없고 메인 스레드 작업이나 비활성 탭에서 callback이 늦어질 수 있다.
- 고정 `+100ms`를 반복하면 지연된 만큼 시나리오 시간이 실제 시간보다 뒤처진다. 현재 구현은 재생 시작 시나리오 시간에 `performance.now()`로 측정한 실제 경과 시간을 더한다.
- 재생 시작 기준값은 화면에 표시할 필요가 없으므로 state가 아닌 ref에 저장한다. ref 변경은 React 재렌더링을 일으키지 않는다.
- 정지하면 현재 `currentTimeMs`를 유지하고 다시 재생할 때 그 값에서 새 기준을 잡는다. 15초에서는 자동 정지하고 다시 재생하면 0초로 초기화한다.
- 재생 시간 state가 약 100ms마다 바뀌어도 의존성 배열이 빈 Three.js 초기화 effect는 다시 실행되지 않아 Scene과 GPU 리소스가 유지된다.
- 사용자가 interval 주기는 정확하지 않으므로 시작 시각과 현재 callback 시각의 실제 간격을 계산해 state에 표시해야 한다고 설명했다.

### 타임라인 드래그와 접근성 값 (2026-09-16)

- 타임라인은 `currentTimeMs`를 `value`로 가지는 제어된 range input이다. React state가 바뀌면 손잡이 위치가 바뀌고 사용자가 손잡이를 옮기면 같은 state가 갱신된다.
- 범위는 `0~15_000ms`, 간격은 100ms이며 `valueAsNumber`를 사용해 input의 문자열 값을 다시 파싱하지 않고 숫자로 읽는다.
- 재생 중 타임라인을 움직이면 먼저 `isPlaying`을 false로 바꾼다. 그렇지 않으면 기존 재생 interval이 옛 시작 기준으로 계산한 시간을 다음 tick에 다시 넣어 사용자가 선택한 시각을 덮어쓸 수 있다.
- `aria-valuetext`는 화면 문구나 계산값이 아니라 접근성 API에 제공할 현재 값 설명이다. 실제 range 값 `12_400`을 스크린 리더가 `12.4초`로 이해할 수 있게 한다.
- `<label>`의 `타임라인`은 컨트롤 이름을 제공하고 `aria-valuetext`는 현재 값의 의미를 제공한다.
- 사용자가 재생을 멈추지 않으면 드래그 입력과 기존 interval이 같은 state를 갱신해 값이 오갈 수 있다고 설명했다.

### 최근접 Frame 선택 (2026-09-16)

- `findNearestFrame`은 목표 재생 시각과 각 Frame의 `timestampMs` 차이의 절댓값을 비교해 가장 가까운 Frame을 반환한다.
- 개념적으로 목표 시각의 이전 Frame과 다음 Frame 중 더 가까운 후보를 고른다. 정확히 같은 거리라면 미래 데이터를 먼저 선택하지 않도록 이전 Frame을 선택한다.
- 배열이 비어 있으면 선택할 Frame이 없으므로 `null`을 반환한다. 목표 시각이 전체 범위보다 앞이나 뒤라면 자연스럽게 첫 Frame이나 마지막 Frame이 선택된다.
- 함수는 구체적인 센서 타입 대신 `timestampMs` 조건만 요구하는 제네릭으로 만들어 Camera, LiDAR와 Object Detection 등에 재사용할 수 있다.
- 현재 가상 배열은 작아서 모든 원소를 한 번 확인하는 `O(n)` 선형 탐색을 사용한다. 이진 탐색은 실제 Frame 수와 탐색 비용이 병목임을 측정한 뒤 도입한다.
- 사용자가 최근접 선택은 이전과 이후 Frame을 찾아 비교하는 원리라고 설명하고 탐색 방식이 이진 탐색인지 질문했다.

### 인과적인 센서 Frame 동기화 (2026-09-16)

- 동기화는 Camera, LiDAR와 Object Detection의 Frame timestamp를 억지로 같게 만드는 작업이 아니다. 하나의 `currentTimeMs`와 동일한 선택 규칙을 각 센서 배열에 적용하는 작업이다.
- 기본 재생은 `findLatestFrameAtOrBefore`로 현재 시각 이하의 최신 Frame을 선택한다. `12_400ms`에 아직 획득하지 않은 `12_500ms` LiDAR Frame을 미리 보여 주지 않고 `12_000ms` Frame을 사용한다.
- `frame.timestampMs - currentTimeMs`가 음수면 Frame이 재생 시각보다 그만큼 오래됐다는 뜻이다. 센서 주기가 다르므로 선택된 Frame 시각과 오차도 센서마다 다를 수 있다.
- 최근접 선택은 양쪽 시각을 허용하는 오프라인 비교에 적합하고, 현재 시각 이하의 최신값 선택은 그 시각까지 시스템이 알고 있던 내용을 재현하는 인과적 재생에 적합하다.
- Trajectory 예측은 미래 시각의 실제 Vehicle State와 명시적으로 비교할 수 있지만, 그 목적 때문에 기본 센서 재생이 미래 Frame을 미리 선택해서는 안 된다.
- `synchronizedFrames`는 `currentTimeMs`가 바뀔 때 다시 렌더링되며 계산되는 파생값이다. 별도 state로 복제하지 않아 재생 시각과 선택 결과가 어긋나는 상태를 만들지 않는다.
- `useMemo`를 쓰면 FPS만 바뀌는 렌더링에서는 재계산을 피할 수 있지만, 재생 중에는 `currentTimeMs`가 100ms마다 바뀌어 대부분 다시 계산된다. 현재 총 63개 Frame의 선형 탐색은 작으므로 최적화하지 않는다.
- 실제 데이터에서 병목이 측정되면 `useMemo`와 이진 탐색을 검토하도록 코드에 `TODO`를 남겼다. `useMemo`는 정확성을 위한 장치가 아니라 성능 최적화 선택이다.
- 사용자가 서로 다른 timestamp라도 같은 관찰 시각을 기준으로 Frame을 골랐기 때문에 동기화된 것이며, 미래 Frame을 고를지 과거 Frame을 유지할지는 분석 목적에 따른 선택 문제라고 설명했다.

### 타임라인 Event 마커 (2026-09-16)

- 이벤트 위치 비율은 `event.timestampMs / durationMs * 100`이다. `12_400ms`는 전체 `15_000ms`의 `82.666…%`이므로 마커의 CSS `left` 값도 같은 비율을 사용한다.
- 재생 손잡이는 `currentTimeMs` state에 따라 계속 움직이지만 이벤트 마커는 로그에 기록된 고정 사건 시각을 나타낸다.
- 마커 위치는 Event 데이터와 시나리오 길이에서 다시 계산할 수 있는 파생값이다. 별도 state에 같은 값을 복제하지 않아 원본 이벤트와 표시 위치가 어긋날 가능성을 만들지 않는다.
- 파생값은 컴포넌트가 렌더링될 때 다시 계산될 수 있지만 입력값이 같으면 결과도 같은 `82.666…%`다. 계산된 값이라는 사실보다 독립적으로 변경할 원본 상태가 아니라는 점이 state가 필요 없는 핵심 이유다.
- `mockScenario.events.map()`을 사용하므로 이벤트 배열에 항목이 추가되면 같은 규칙으로 마커가 추가된다.
- 마커 레이어의 좌우 여백을 range 손잡이 반지름과 맞춰 비율의 양 끝이 손잡이 중심의 실제 이동 범위와 일치하게 했다.
- 마커는 `pointer-events: none`으로 드래그를 가로막지 않으며 이벤트 종류와 시각을 화면 문구, `title`과 접근성 이름으로 제공한다.
- 사용자가 이벤트 발생 시각을 전체 프로그램 길이에 대한 백분율로 바꿔 위치를 표시하며, 고정된 계산값이므로 별도 state가 필요 없다고 설명했다.

### 선택된 센서 Frame의 실제 화면 반영 (2026-09-16)

- LiDAR Frame마다 `BufferGeometry`를 새로 만들지 않고, 최대 Frame인 숫자 63개·포인트 21개 크기의 `Float32Array`와 `BufferAttribute`를 마운트 시 한 번 생성한다.
- 선택된 Frame이 바뀔 때 `positions`를 기존 배열 앞부분에 복사하고 `needsUpdate = true`로 다음 렌더의 GPU Buffer 갱신을 요청한다.
- `drawRange`는 Buffer의 최대 용량과 이번 Frame에서 실제로 그릴 포인트 수를 분리한다. 15개 Frame 뒤에 남는 6개 포인트의 초기값이나 이전값을 그리지 않고 앞의 15개만 draw call에 사용하게 한다.
- 사용자가 최대 크기의 배열에서 실제 데이터가 15개뿐이면 뒤쪽 값이 남을 수 있으므로 그리지 않을 범위를 알려 주는 것이 `drawRange`라고 설명했다.
- 선택된 LiDAR Frame 객체는 500ms마다 바뀌므로 좌표 갱신 effect도 재생 시간 state의 100ms 변경마다 실행되지 않고 선택 결과가 바뀔 때만 실행된다.
- `computeBoundingSphere()`는 GPU에 구를 전송하는 함수가 아니다. JavaScript/CPU에서 `position` Attribute를 순회해 경계 구를 다시 계산하고, Three.js가 Camera frustum과 비교해 객체 전체를 draw call에 넣을지 먼저 판정할 때 사용한다.
- bounding sphere 계산은 `drawRange`가 아닌 전체 Attribute 수를 기준으로 하므로 남은 좌표 때문에 실제 표시 범위보다 큰 구가 될 수 있다. 이는 불필요하게 그릴 가능성은 늘려도 보여야 할 점을 잘못 제거하지 않는 보수적 판정이다.
- Camera는 선택된 `imageUrl` 문자열만 정보 카드에 표시하고 실제 이미지는 아직 요청하지 않는다. Object Detection도 객체 수와 `pedestrian-1` ID만 표시하며 3D 박스는 Phase 5에서 만든다.
- 실제 타임라인 입력을 `0ms`에서 `11_000ms`로 이동해 Camera URL, LiDAR 포인트 수, 객체 ID가 함께 갱신되고 WebGL 포인트 draw count가 15개에서 21개로 바뀌는 것을 확인했다.

### 보행자 3D 바운딩 박스 (2026-09-17)

- `pedestrian`은 Three.js 용어가 아니라 `ObjectDetection.category`에서 객체 종류가 보행자임을 나타내는 문자열 값이다.
- 단위 크기 `BoxGeometry(1, 1, 1)`와 wireframe `MeshBasicMaterial`을 한 번 생성하고, 선택 Frame이 바뀔 때 같은 Mesh의 위치·크기·회전·표시 여부만 바꾼다.
- 데이터의 `center: [x, y, z]`는 Mesh의 `position`에 그대로 대응한다. `size: [width, length, height]`는 X가 좌우, Y가 높이, Z가 진행 방향인 장면 축에 맞춰 `scale(width, height, length)` 순서로 재배치한다.
- Y가 수직축이므로 yaw는 `rotation.y`에 적용한다. 현재 mock의 yaw는 0이지만 같은 경로로 이후 회전값을 반영할 수 있다.
- 현재 보행자 중심 `y=0.9`와 높이 `1.8`은 중심이 높이의 절반이어서 박스 아래가 `y=0`에 닿는다. 렌더러가 바닥 높이를 계산한 것이 아니며 center가 달라지면 박스도 그 위치로 이동한다.
- 11초 전에는 선택된 Object Detection Frame에 보행자가 없어 `visible = false`이고, 11초부터 같은 `pedestrian-1` 데이터로 `visible = true`가 된다.
- Geometry와 Material은 Frame마다 재생성하지 않으며 컴포넌트 cleanup에서 각각 `dispose()`한다.
- 사용자가 Three.js 박스 축이 X·Y·Z 순서이므로 데이터의 width·length·height를 장면 축에 맞게 넣어야 하며, 현재 데이터가 지면에 붙는 위치를 가정하고 있다고 설명했다.
- `null`은 매번 새 주소에 할당되는 객체가 아니라 JavaScript 원시값이다. React effect 의존성은 `Object.is`로 비교하므로 선택 결과가 계속 `null`이면 `null → null`은 변화가 아니며 effect가 다시 실행되지 않는다.
- Frame 선택 함수 자체는 `currentTimeMs`에 따른 React 렌더마다 호출된다. 현재 mock에는 0초부터 Object Detection Frame이 있어 선택 결과는 `null`이 아니라 객체 배열이 빈 Frame이고, Frame 참조가 1초마다 바뀔 때 박스 갱신 effect가 실행된다.
- 빈 배열에서 보행자를 찾고 `visible = false`를 다시 지정하는 현재 비용은 작다. 실제 데이터에서 병목으로 측정될 때만 선택된 보행자를 별도 파생값으로 분리하는 최적화를 검토한다.
- 사용자가 Detection이 없을 때도 Geometry를 메모리에 유지하고 `visible`로 draw call만 제어하면 Frame마다 객체와 GPU 리소스를 생성·해제하는 비용을 피할 수 있다고 설명했다.

### 차량 3D 바운딩 박스 (2026-09-17)

- Vehicle State는 시간에 따라 변하는 위치·yaw·속도·가속도를 보관하지만 차량 크기는 고정값이므로 `ScenarioData.egoVehicleSize`에 한 번만 저장한다.
- 보행자와 차량은 모두 단위 박스에서 크기만 달라지므로 `BoxGeometry(1, 1, 1)` 하나를 공유하고, 주황색과 초록색을 구분하기 위한 Material은 각각 소유한다.
- 현재 Vehicle State의 `position`은 3D 박스 중심이 아니라 지면 위 차량 footprint 중심이다. 차량 Mesh 중심 Y는 `groundY + height / 2`로 올려 하부가 지면에 닿게 한다.
- 보행자 Detection의 `center`는 이미 박스 중심이지만 Vehicle State 위치는 지면 기준점이므로 같은 숫자 배열 형태라도 의미에 따라 적용 방식이 다르다.
- `findLatestFrameAtOrBefore`로 현재 시각 이하의 최신 Vehicle State를 선택해 미래 상태를 미리 보여 주지 않는다. 선택된 Frame 참조가 바뀔 때 같은 차량 Mesh의 transform만 갱신한다.
- 보간은 단순한 화면 효과가 아니라 두 Frame 사이 목표 시각의 위치와 yaw를 계산하는 작업이다. 부드러운 움직임은 계산된 중간 위치를 매 재생 시각에 반영한 결과이며 현재 단계에는 넣지 않았다.
- 사용자가 차량 위치를 높이 절반만큼 올려야 하부가 지면에 닿는다고 설명하고, 보간이 부드러운 움직임인지 차량 위치 계산인지 질문해 두 개가 원인과 결과 관계임을 확인했다.

### 예상 주행 경로 3D 선 (2026-09-17)

- 현재 재생 시각 이하의 최신 `TrajectoryFrame`은 그 시점에 분석 가능한 Planning 스냅샷이다. Frame의 `timestampMs`보다 미래에 생성된 계획을 미리 선택하지 않는다.
- `TrajectoryPoint.position`은 공통 시나리오 좌표계의 절대 위치이고, `offsetMs`는 좌표에 더하는 값이 아니라 계획 생성 시점부터 몇 ms 뒤의 위치인지 나타낸다. 예상 절대 시각은 `TrajectoryFrame.timestampMs + offsetMs`다.
- 최대 4개 점을 담는 재사용 Buffer에 선택 계획의 좌표를 복사하고 `needsUpdate`로 GPU 전송을 예약하며 `drawRange`로 현재 점 개수만 그린다.
- 경로는 Grid와 겹쳐 깜빡이는 z-fighting을 피하기 위해 화면에서만 Y를 0.05m 올린다. 분석용 원본 위치는 바꾸지 않는다.
- 서로 다른 Planning Frame을 보간하면 플래너가 실제로 출력하지 않은 중간 경로를 만들어 로그의 의사결정 변화를 흐릴 수 있으므로 현재는 계획 스냅샷을 그대로 전환한다.
- 12.0초 계획의 14.0초 예상 위치 Z 20m와 14.0초 실제 Vehicle State Z 15.6m는 4.4m 차이가 난다. 이 오차는 계획 추종·예측 평가에 중요한 값이지만, 12.4초에 보행자를 반영한 새 급제동 계획이 생성됐으므로 기존 계획이 폐기된 맥락까지 함께 봐야 한다.
- 사용자가 당시 Planning의 예상 위치와 이후 같은 시각의 실제 측정 위치를 비교하는 작업이 계획 품질을 판단하는 중요한 지표라고 설명했다.

### 충돌 예상 구간 강조 (2026-09-17~19)

- `TrajectoryPoint`는 떨어진 점 표본이므로 충돌은 점 일치만 비교하지 않고 인접한 두 점 사이의 선분을 검사해야 한다. 양 끝점이 영역 밖이어도 가운데가 통과할 수 있다.
- 현재 가상 시나리오는 차량과 보행자의 yaw가 0이고 보행자가 정지해 있다고 가정한다. XZ 평면에서 보행자 footprint를 차량 반폭·반길이만큼 확장하면 차량 박스 전체 대신 차량 중심 경로를 검사할 수 있다.
- 보행자 폭·길이 0.6m와 차량 폭 1.8m·길이 4.5m로 만든 확장 영역은 X `[-1.2, 1.2]`, Z `[17.45, 22.55]`다.
- 선분을 `P(t) = start + t(end - start)`로 표현하고 X·Z 각 축에서 영역 안에 있는 `t` 범위의 교집합을 구하는 slab clipping을 사용한다. 이 비율로 XYZ를 보간해 실제로 겹친 일부의 양 끝점을 얻는다.
- 12.0초 계획은 마지막 선분 Z `16 → 20` 중 `17.45 → 20`이 충돌 구간이고, 12.4초 급제동 계획은 최대 Z 15.6에서 멈춰 충돌 구간이 없다.
- 전체 경로는 노란 `Line`으로 유지하고 충돌 부분만 빨간 `LineSegments`로 덮는다. 불연속 충돌 구간끼리 자동으로 연결하지 않으며, 최대 18개 숫자의 Buffer를 Frame 사이에서 재사용한다.
- 충돌 결과는 선택된 Trajectory와 보행자에서 계산되는 파생값이므로 별도 React state로 복제하지 않는다. 두 선택 객체가 바뀔 때만 effect가 Buffer를 갱신한다.
- 일반적인 회전·커브 충돌에서는 미래 시각별 차량과 객체의 OBB를 SAT로 비교하고 샘플 사이 움직임에는 연속 충돌 판정이 필요하다. 현재 Trajectory에는 미래 차량 yaw와 보행자 미래 예측이 없어 이번 범위에는 포함하지 않는다.
- 사용자가 확장 사각형 방식은 yaw가 맞는 조건을 전제로 한다는 점을 짚고 실제 충돌 판정에서 회전과 커브를 어떻게 다루는지 질문했다.
- 사용자가 Planning 경로는 이미 인접점 사이의 최소 선분 집합이고, 서로 떨어진 충돌 조각은 `LineSegments`의 독립된 선분 쌍으로 그려야 한다고 설명했다. 원래 Planning 선분 전체가 아니라 slab clipping으로 확장 영역 안에 들어온 일부만 빨간 선분이 된다는 점을 보완했다.
- 축 정렬 사각형 두 개는 각 축의 중심 거리와 반크기 합을 비교해 겹침을 보장할 수 있고, 선분은 X·Z에서 허용되는 `t` 구간의 교집합이 비지 않을 때만 충돌한다. 이 수학적 보장은 yaw 0·정지 객체·선형 구간이라는 모델 안에서 정확하며, 모델 가정 자체가 실제 세계의 한계다.
- 사용자가 충돌 여부만 응용하는 것보다 판정 수식이 왜 성립하고 어떤 조건에서 보장되는지 이해하고 함수를 만드는 과정도 학습의 핵심이라고 밝혔다. 이후 기하 알고리즘은 구현과 함께 성립 이유와 한계를 설명한다.

### 보행자 선택 (2026-09-19, 이해 확인 대기)

- Canvas click의 `clientX`, `clientY`를 `getBoundingClientRect()` 안의 비율로 만든 뒤 NDC `[-1, 1]`로 변환한다. DOM Y는 아래로 증가하고 WebGL NDC Y는 위로 증가하므로 Y 부호를 뒤집는다.
- `Raycaster.setFromCamera()`는 Camera 위치에서 NDC가 가리키는 3D 방향으로 광선을 만들고, 보행자 Mesh의 `BoxGeometry` 삼각형 면과 교차하는지 검사한다. `wireframe`은 렌더링 방식이라 선 사이의 면도 선택 영역이다.
- 현재 Three.js Raycaster는 `visible = false`를 검사하지 않으므로 숨긴 보행자를 handler에서 먼저 제외한다. 클릭 직전에 Camera와 Mesh의 world matrix를 갱신해 seek 직후 첫 렌더 전에도 최신 transform을 사용한다.
- React는 Frame 객체나 Three.js Mesh 대신 안정적인 `ObjectDetection.id`를 선택 state로 가진다. click handler는 Mesh `userData`의 최신 ID를 읽어 오래된 Frame closure를 피한다.
- 같은 ID가 다음 Detection Frame에도 있으면 선택을 유지하고, 빈 공간을 클릭하거나 대상이 사라지면 해제한다. Three.js는 기존 Material 색만 바꾸며 새 GPU 리소스를 만들지 않는다.
- Canvas click listener는 마운트 시 한 번 등록하고 cleanup에서 같은 함수 참조로 제거한다. Raycaster와 Vector2는 JavaScript 계산 객체라 별도 `dispose()`가 필요 없다.

### 선택 객체 정보 표시 (2026-09-22, 사용자 이해 확인 대기)

- `Raycaster.intersectObject()`는 교차 지점 배열을 반환하므로 `.length > 0`은 지정한 Mesh와 한 번 이상 교차했는지 확인한다. `recursive: false`는 자식 객체 검사만 제외한다. 사용자가 배열 결과에서 `hit.object`를 직접 사용할 수 있는지 질문했고, 여러 객체를 검사할 때는 그 객체의 ID를 읽는 방법이 유용함을 설명했다.
- React에는 안정적인 객체 ID만 선택 state로 저장하고, 패널에 필요한 신뢰도·크기·인식 시각은 현재 Detection Frame에서 같은 ID의 객체를 찾아 표시한다. 이 방식은 Frame이 바뀔 때 오래된 객체 정보를 고정해 두지 않는다.
- 브라우저에서 선택 후 12초 96%에서 11초 90%로 갱신되며, 빈 곳 클릭과 대상 소멸 시 안내 문구로 돌아오는 것을 확인했다. 사용자가 이 파생 데이터 흐름을 설명할 수 있는지는 아직 확인하지 않았다.

### 가상 전방 카메라 패널 (2026-09-23, 사용자 이해 확인 대기)

- `CameraFrame`은 촬영 시각과 직렬화 가능한 이미지 URL만 보관한다. React가 선택된 URL을 `<img src>`에 반영하면 브라우저가 정적 파일 요청·디코딩·표시를 담당한다.
- `public/mock-camera/*.svg`는 앱에서 `/mock-camera/*.svg` URL로 접근할 수 있다. 가상 SVG에 고정 16:9 크기를 주어 Frame 전환 시 레이아웃이 흔들리지 않게 했다.
- 카메라 주기가 1초이므로 재생 시각 12.4초에는 12초 Camera Frame이 최신 과거 값이다. 13초 급제동 Frame을 미리 표시하지 않는 인과적 동기화가 브라우저 검사에서 유지됐다.
- 카메라 패널은 React UI이며 Three.js Texture가 아니다. 따라서 새 Geometry·Material·Texture와 `dispose()` 대상이 추가되지 않았다.
- 사용자가 URL 데이터와 실제 브라우저 이미지 객체의 책임 차이를 설명할 수 있는지는 아직 확인하지 않았다.

### Viewer 책임 분리 리팩터링 (2026-09-23, 사용자 이해 확인 완료)

- Custom Hook은 기능을 숨기는 이름표가 아니라 서로 함께 변하는 state와 effect의 책임 경계다. `usePlayback`은 시간 진행 규칙을, `useObjectSelection`은 선택 ID와 최신 Frame 조회 규칙을 묶는다.
- `selectScenarioFrames`는 React state를 만들지 않는 순수 함수다. 같은 시나리오와 같은 시각을 넣으면 같은 선택 규칙으로 결과를 만들기 때문에 동기화 정책을 UI와 분리해서 읽을 수 있다.
- `ViewerCanvas`는 702줄에서 78줄로 줄었고, 현재는 데이터와 기능을 조립하는 역할만 한다. 표시 전용 컴포넌트는 받은 props를 화면으로 바꾸며 Three.js 객체를 직접 다루지 않는다.
- `useThreeViewer`는 여전히 큰 Hook이지만 Scene과 GPU 리소스의 생성·재사용·해제를 같은 소유자 안에서 추적하려고 한곳에 유지했다. 줄 수만 줄이려고 여러 Hook으로 나누면 같은 Geometry를 누가 생성하고 누가 `dispose()`하는지 오히려 흩어질 수 있다.
- `ViewerCanvas`의 `"use client"` 아래에서 import되는 컴포넌트와 Hook도 Client Component 그래프에 포함된다. 브라우저 API를 쓰는 모든 파일에 지시문을 반복할 필요는 없다.
- 주석은 `무엇을 하는 코드인지`를 문법 그대로 반복하기보다 `왜 Buffer를 재사용하는지`, `왜 DOM Y를 뒤집는지`, `왜 공유 Geometry를 한 번만 정리하는지`처럼 코드만으로 알기 어려운 이유와 책임을 설명해야 한다.
- 구조를 바꿔도 동작이 같아야 리팩터링이다. TypeScript와 build뿐 아니라 실제 Canvas 클릭, seek 뒤 ID 유지, Buffer draw count, 카메라의 인과적 Frame 선택과 화면 이탈 cleanup을 회귀 검사했다.
- 사용자가 Three.js 관련 객체와 기능을 `useThreeViewer`에 모아 생성부터 메모리·GPU 리소스 정리까지 같은 Hook이 맡게 한 구조라고 설명했다. 순수 충돌 계산은 Three.js 런타임 책임이 아니므로 `_analysis`에 남는다는 경계도 함께 확인했다.

## 다음 단계에서 배울 내용

Phase 5의 기능과 Viewer 책임 분리까지 완료했으며 정리된 데이터 흐름과 Camera Frame URL·브라우저 이미지 로딩의 책임에 대한 이해 확인이 남아 있다.

- Canvas DOM 좌표를 NDC로 변환하는 식과 Y 부호를 뒤집는 이유
- Camera 광선과 Mesh 삼각형의 교차, `visible`과 wireframe이 선택 판정에 미치는 영향
- React의 객체 ID 선택 state와 Three.js Material 시각 피드백의 책임 분리
- `ViewerCanvas`, Custom Hook, 표시 컴포넌트와 Three.js 런타임 Hook 사이의 책임 분리
- 이해 확인 뒤 Phase 6의 현재 Frame 캐시와 이전·다음 Frame prefetch 구조
