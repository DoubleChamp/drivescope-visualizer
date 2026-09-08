<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DriveScope 작업 규칙

- 작업 전 `docs/PROJECT_BRIEF.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`에서 현재 범위와 다음 한 단계를 확인한다.
- 한 번에 하나의 작은 단계만 진행한다. 구현 전에 무엇을 만들고 왜 필요한지 설명하고 사용자 승인을 기다린다.
- 사용자가 현재 원리를 설명할 수 있는지 확인하기 전에는 다음 단계나 기능으로 넘어가지 않는다.
- React는 화면 구성, 사용자 입력, 재생 상태를 담당하고 Three.js는 Canvas, Scene, Camera, GPU 리소스, 렌더 루프를 담당한다.
- React Three Fiber를 사용하지 않는다. 매 프레임 센서 데이터를 React state에 넣지 않고 Three.js 런타임 객체와 재사용 가능한 Buffer로 관리한다.
- Geometry, Material, Texture, Renderer를 만든 코드는 컴포넌트 해제 시 관련 리소스도 정리한다.
- 복잡한 추상화와 사전 최적화를 피하고, 가상 데이터로 원리를 확인한 뒤 성능 전후를 수치로 비교한다.
- 각 단계가 끝나면 직접 실행해 검증하고 변경 파일, 핵심 코드, 검증 명령, 결과를 설명한다.
- 단계 종료 시 `docs/PROGRESS.md`를 갱신하고 실제로 학습한 내용만 `docs/LEARNING_NOTES.md`에 기록한다.
- 두 컴퓨터 간 충돌을 막기 위해 작업 시작 전 GitHub Desktop에서 원격 변경 여부를 확인한다.
- `AGENTS.md`, `CLAUDE.md`, `docs/`는 두 컴퓨터의 작업 기준을 동일하게 유지하도록 Git에 추적하고 공유한다. 비밀값, 인증 정보와 불필요한 개인 경로는 기록하지 않는다.
- 커밋 메시지는 사용자가 다르게 요청하지 않는 한 Conventional Commit 타입 뒤의 설명을 한글로 작성한다.
- 승인된 한 단계의 구현, 검증과 문서 갱신이 끝나면 현재 작업 브랜치에 commit까지만 한다. `origin` push는 사용자가 GitHub Desktop에서 직접 수행한다.
- force push와 기존 변경 되돌리기는 사용자가 명시적으로 요청하지 않는 한 실행하지 않는다.

상세한 제품 범위와 단계별 기준은 `docs/` 아래 문서를 따른다.
