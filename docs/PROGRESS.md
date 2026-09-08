# DriveScope 진행 상황

마지막 갱신: 2026-09-08

## 현재 위치

- 현재 Phase: Phase 1 — 완료
- 현재 작업: Phase 1 구현·cleanup 감사와 공유 문서 Git 추적 전환 완료
- 다음 한 단계: 사용자가 GC와 명시적 cleanup의 차이를 확인한 뒤 Phase 2의 가상 포인트 100개 구현안을 설명하고 승인을 기다린다.
- 아직 구현하지 않은 것: 가상 포인트와 `BufferGeometry`를 포함한 Phase 2 이후 기능

## 완료한 작업

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

- 첫 커밋 `8d7c3f2 초기 환경 구성`이 `main`과 `origin/main`에 존재한다.
- 현재 작업 브랜치는 `feat/phase-1-three-scene`이다.
- Phase 1 코드와 공유 문서는 `feat/phase-1-three-scene`의 `6048ba1`에 commit하고 `origin`에 push했다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`는 Git에서 추적해 다른 컴퓨터에서도 같은 작업 기준을 사용한다.
- 루트 HTML의 한국어 언어 태그는 올바른 BCP 47 코드인 `ko`를 사용한다.
- 공개 프로젝트 소개용 `README.md`는 추적 가능한 상태로 남긴다.
- 이후 승인된 단계는 구현과 검증을 마칠 때마다 Codex가 현재 작업 브랜치에 commit까지만 한다. 사용자가 GitHub Desktop에서 변경을 확인한 뒤 직접 push한다.

## 다음 구현 진입 조건

1. 지역 변수인 Three.js 객체가 callback closure를 통해 계속 도달 가능할 수 있음을 사용자가 설명한다.
2. JS 객체 회수와 WebGL/GPU 리소스 해제가 서로 다른 층이라는 점을 설명한다.
3. `grid.dispose()`, `scene.clear()`와 `renderer.dispose()`의 서로 다른 역할을 설명한다.
4. Phase 2 첫 단계인 가상 포인트 100개의 최소 구현 범위를 설명하고 사용자 승인을 받는다.

## 추천 커밋 메시지

Phase 1 변경에는 `feat: Viewer Three.js 기본 장면 완성`을 사용했다. 이후에도 각 단계의 검증과 문서 갱신이 끝나면 한글 Conventional Commit을 만들되 push는 사용자가 직접 수행한다.
