# DriveScope

카메라, LiDAR, 객체 인식과 예상 주행 경로를 하나의 타임라인에서 살펴보는 자율주행 로그 시각화 학습 프로젝트입니다. 보행자 등장부터 인식·충돌 예상·급제동까지의 시간 관계를 가상 시나리오로 확인하고, 같은 Viewer에서 실제 nuScenes mini 센서 로그를 재생합니다.

Next.js App Router, React, TypeScript와 Three.js를 사용합니다. React는 UI·입력·재생 상태를, Three.js는 3D 장면·GPU 리소스·렌더 루프를 담당합니다.

## 현재 확인할 수 있는 데모

| 항목 | 가상 급제동 데모 | 실제 nuScenes mini |
| --- | --- | --- |
| 데이터 준비 | 저장소에 포함, 별도 다운로드 없음 | 원본을 변환하거나 v3 산출물을 복사 |
| 재생 구간 | 15초 | 기본 첫 scene은 약 19.2초 |
| Camera / LiDAR | 가상 SVG 이미지 / 15~21포인트 | CAM_FRONT JPEG / 약 34,700포인트 |
| 차량 | 가상 차량 위치 | 실제 ego 위치·방향과 추적 3D Camera |
| 분석 | 보행자 박스·선택·예상 경로·충돌 구간·급제동 마커 | 현재 연결 범위는 점군·전방 이미지·차량 pose |

실제 데이터에는 객체 인식·예상 경로·급제동 이벤트를 아직 연결하지 않았습니다. 가상 급제동 데모는 분석 UI와 시간 동기화를 확인하도록 작성한 데이터이며 실제 사고 기록이나 AI 추론 결과가 아닙니다. 현재는 로컬 실행을 지원하고, 웹 배포와 1분 데모 영상은 [로드맵](docs/ROADMAP.md)의 후속 단계입니다.

## 빠르게 실행하기

검증한 환경은 Windows PowerShell, Node.js 24.x, pnpm 11.24.0과 WebGL 2를 지원하는 브라우저입니다. Python은 실제 데이터를 새로 변환할 때만 필요합니다.

아래 명령은 PowerShell 기준입니다. macOS·Linux에서는 `pnpm.cmd`와 `npm.cmd` 대신 `pnpm`과 `npm`을 사용합니다. 변환기의 경로와 줄 연결 문법도 해당 셸에 맞게 바꿔야 하며, 검증 환경은 Windows입니다.

pnpm이 없다면 Node.js 설치 후 준비합니다.

```powershell
npm.cmd install --global pnpm@11.24.0
```

GitHub Desktop에서 저장소를 clone하고 프로젝트 디렉터리에서 터미널을 엽니다. Git CLI를 사용하는 경우:

```powershell
git clone https://github.com/DoubleChamp/drivescope-visualizer.git
cd drivescope-visualizer
```

의존성을 설치하고 개발 서버를 실행합니다.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

[http://localhost:3000](http://localhost:3000)의 **분석 Viewer 열기**를 누르거나 [http://localhost:3000/viewer](http://localhost:3000/viewer)로 이동합니다. 서버 종료는 터미널에서 `Ctrl+C`입니다.

처음 clone한 프로젝트에는 실제 데이터 설정이 없습니다. Viewer는 실제 manifest 요청 실패를 안내하면서 **가상 데모**를 표시합니다. 이 상태에서도 재생·탐색·보행자 선택을 사용할 수 있습니다. 실제 모드가 열리는 기존 환경에서 가상 데모로 돌아가려면 `DRIVESCOPE_DATA_ROOT` 설정을 제거하고 서버를 다시 실행합니다. 현재 별도의 모드 전환 버튼은 없습니다.

## 가상 데모 살펴보기

1. 재생 버튼으로 전체 흐름을 보거나 타임라인을 드래그해 아래 시점으로 이동합니다. 탐색하면 재생은 정지합니다.
2. 11초 이후 3D 장면의 보행자 박스를 클릭합니다. 오른쪽 선택 객체 패널에서 ID·분류·신뢰도·인식 시각을 확인합니다.
3. 12초와 12.4초의 예상 경로·충돌 강조를 비교하고, 카메라와 센서별 Frame 시각도 함께 확인합니다.

| 재생 시각 | 확인할 내용 |
| --- | --- |
| 0~10초 | 차량의 정상 주행 |
| 10초 | 가상 이미지와 점군에 보행자 등장 |
| 11초 | 보행자 인식 박스와 선택 가능한 메타데이터 |
| 12초 | 예상 경로에서 보행자와 충돌할 구간 강조 |
| 12.4초 | 급제동 마커·변경된 계획 경로·충돌 강조 해제 |
| 13.4초 이후 | 가상 차량 정지 |

센서는 동일한 재생 시각을 기준으로 각각 **그 시각 이하의 최신 Frame**을 선택합니다. 따라서 센서 Frame 시각이 서로 달라도 같은 목표 시각에 동기화된 상태일 수 있습니다. 예를 들어 가상 Camera는 1초 주기이므로 12.4초에서도 12초 사진을 표시하고, 13초 Frame에서 급제동 이후 이미지로 바뀝니다.

## 실제 nuScenes mini 연결하기

원본·변환 산출물·개인 데이터 경로는 저장소에 포함하지 않습니다. 다른 컴퓨터에서 준비한 **v3 scene 디렉터리 전체**가 있다면 변환 과정은 생략하고 아래 설정 단계부터 진행합니다.

### 1. 원본 준비와 변환

[nuScenes 공식 다운로드](https://www.nuscenes.org/nuscenes#download)에서 `v1.0-mini` 데이터를 준비하고 압축을 해제합니다. 원본 루트에는 `v1.0-mini/`, `samples/`, `sweeps/`, `maps/`가 모입니다. 다운로드와 원본 구조는 [공식 devkit 안내](https://github.com/nutonomy/nuscenes-devkit#nuscenes-setup)를 따릅니다.

아래 예시의 `C:/DriveScopeData`는 원하는 데이터 저장 위치로 바꿉니다. `--dataroot`는 `v1.0-mini` 폴더 자체가 아니라 그 폴더를 포함한 **원본 루트**입니다.

Python 3.12로 가상환경과 변환 의존성을 준비합니다. 명시적으로 가상환경의 Python을 실행하므로 activation은 필요 없습니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-converter.txt
.\.venv\Scripts\python.exe scripts\convert_nuscenes_mini.py `
  --dataroot "C:/DriveScopeData/nuscenes-mini" `
  --output-root "C:/DriveScopeData/drivescope-output-v3" `
  --scene-index 0
```

기본 첫 scene인 `scene-0061`을 다음 구조로 생성합니다. Camera·LiDAR·ego pose는 각각 39개입니다. 변환기는 sample keyframe을 사용하며 중간 sweeps는 출력하지 않습니다. 같은 출력 scene 디렉터리가 이미 있으면 덮어쓰지 않으므로 다시 변환할 때는 다른 출력 루트를 지정합니다.

```text
drivescope-output-v3/
└─ scene-0061/
   ├─ manifest.json
   ├─ camera/
   │  └─ *.jpg
   └─ lidar/
      └─ *.bin
```

Python은 원본을 웹 제공용 파일로 만드는 **오프라인 전처리 도구**입니다. 브라우저 재생이나 API 요청마다 실행하지 않습니다. 이미 v3 산출물이 있으면 Viewer 실행에 Python이 필요 없습니다.

### 2. 산출물 검증과 서버 설정

먼저 실제 manifest를 검사합니다. 경로를 넘기면 JSON 계약뿐 아니라 카메라 파일 존재와 LiDAR 바이너리 크기도 확인합니다.

```powershell
pnpm.cmd validate:manifest "C:/DriveScopeData/drivescope-output-v3/scene-0061/manifest.json"
```

프로젝트 루트에 `.env.local`을 만들고 **manifest가 들어 있는 scene 디렉터리**를 지정합니다.

```dotenv
DRIVESCOPE_DATA_ROOT="C:/DriveScopeData/drivescope-output-v3/scene-0061"
```

설정 후 서버를 다시 실행합니다.

```powershell
pnpm.cmd dev
```

Viewer 상단의 **실제 센서 로그**와 **전방 이미지 39장**을 확인합니다. 연결 여부는 [manifest 응답](http://localhost:3000/api/drivescope-data/manifest.json)에서도 확인할 수 있습니다. 이 서버 전용 설정은 브라우저에 로컬 경로를 전달하지 않습니다. 서버가 파일을 HTTP로 제공하고 브라우저가 필요한 Frame을 요청합니다. `.env.local`은 Git에서 제외합니다.

현재 로더는 `schemaVersion: 3`만 허용합니다. v2는 좌우 축의 의미가 다르므로 버전 숫자만 수정해서 사용할 수 없습니다. v3 산출물을 복사하거나 원본에서 다시 변환해야 합니다. 파일 계약·좌표계는 [DATA_FORMAT.md](docs/DATA_FORMAT.md)를 참고합니다.

### 3. 실제 장면 탐색

- 0초에는 카메라 사진이 있지만 첫 LiDAR·ego Frame은 35ms여서 점군과 차량 위치가 대기 상태일 수 있습니다. 재생하거나 타임라인을 이동하면 표시됩니다.
- 12.4초 등으로 탐색해 전방 이미지·점군·차량 위치를 함께 봅니다. 3D Camera는 실제 ego 차량을 따라갑니다. pose 보간과 Camera smoothing은 아직 적용하지 않았습니다.
- 오른쪽 **차량 위치** 패널에서 위치·방향을, **Frame 동기화** 패널에서 표시 Frame의 시각과 재생 시각의 차이를 비교합니다.
- 다음 이미지 다운로드·디코딩 중에는 기존 사진과 촬영 시각을 유지합니다. 정상 교체는 조용히 진행하고, 같은 사진을 500ms 이상 유지하며 준비 중일 때 헤더에 **이미지 지연**을 표시합니다.

## 검증과 성능 측정

기본 검증과 production 실행:

```powershell
pnpm.cmd validate:manifest
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd build
pnpm.cmd start --port 3100
```

경로 없는 `validate:manifest`는 작은 fixture와 검증 규칙을 검사합니다. 로컬 실제 파일을 검사하려면 앞서 설명한 manifest 경로를 함께 넘깁니다. production 서버는 [http://localhost:3100/viewer](http://localhost:3100/viewer)로 접속합니다.

Python 변환기 테스트는 변환 가상환경을 준비한 경우 실행합니다.

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p test_convert_nuscenes_mini.py
```

실제 데이터가 연결된 production 서버를 실행한 상태에서 **다른 터미널**에서 benchmark를 실행합니다. 설치된 Chrome이 필요하며 기본 경로가 다르면 `DRIVESCOPE_BENCHMARK_CHROME` 환경변수로 실행 파일을 지정합니다.

```powershell
$env:DRIVESCOPE_BENCHMARK_URL = 'http://localhost:3100'
pnpm.cmd benchmark:viewer
```

benchmark는 브라우저를 자동 제어해 가상·실제 모드를 같은 조건으로 각 3회 측정합니다. 로딩은 5개 탐색 시점의 cache miss를, FPS는 초기 2.2초 이후 1초 간격으로 10회 읽습니다. 가상 비교를 위한 응답 변경은 해당 측정 브라우저에만 적용합니다. 결과는 콘솔과 `node_modules/.cache/drivescope-benchmark/latest.json`에 저장합니다.

Frame 로딩 시간은 비동기 HTTP 대기를 포함한 로더 Promise의 경과 시간이고, FPS는 rAF에서 `renderer.render()`를 호출한 빈도입니다. 순수 렌더링 시간·GPU 시간·순간 정지를 직접 측정한 값으로 해석하지 않습니다. 측정 환경·기준선·한계는 [PERFORMANCE.md](docs/PERFORMANCE.md)에 있습니다.

## 문제 해결

| 상태 | 확인할 내용 |
| --- | --- |
| 처음 실행해 실제 연결 오류와 가상 데모가 보임 | 실제 데이터 미설정 상태입니다. 가상 데모는 그대로 사용할 수 있습니다. 실제 데이터가 필요하면 위 연결 절차를 진행합니다. |
| manifest HTTP 503 | `DRIVESCOPE_DATA_ROOT` 설정과 서버 재시작 여부를 확인합니다. |
| manifest·이미지·LiDAR HTTP 404 | 설정이 출력 루트가 아닌 scene 디렉터리인지, manifest가 참조한 파일을 함께 복사했는지 확인합니다. |
| manifest 버전·timestamp 검증 실패 | 오류 상세를 보고 `validate:manifest`로 검사합니다. v2 파일은 v3로 다시 준비합니다. |
| LiDAR 바이너리 크기 오류 | 파일 크기가 `pointCount × 12`바이트인지 산출물 검증으로 확인합니다. 정상 파일을 준비한 뒤 같은 시점에서 재시도하거나 다른 시점으로 이동합니다. |
| 이미지 로딩 실패 | 파일·연결을 확인하고 **이미지 다시 시도**를 누릅니다. 기존 사진은 성공할 때까지 유지됩니다. |
| 0초에서 실제 점군·차량 위치가 없음 | 첫 Frame보다 이른 시각일 수 있습니다. 기본 scene은 첫 LiDAR·ego Frame이 35ms입니다. |
| `pnpm` 실행이 PowerShell 정책에 차단됨 | 이 문서의 `pnpm.cmd` 명령을 사용합니다. |
| 같은 프로젝트의 개발 서버가 이미 실행 중이라는 안내 | 안내된 기존 주소로 접속합니다. 설정을 바꿔 다시 실행해야 한다면 기존 터미널에서 `Ctrl+C`로 종료한 뒤 실행합니다. 포트만 바꿔 같은 프로젝트의 개발 서버를 동시에 실행할 수는 없습니다. |

manifest 연결 문제를 해결한 뒤 **실제 데이터 다시 연결**을 누르면 재생이 정지하고 0초에서 시작합니다. 환경변수를 바꾼 경우에는 먼저 서버를 재시작합니다.

## 코드와 문서 찾아보기

| 관심사 | 시작 파일 |
| --- | --- |
| 소스·재생 시계·센서 선택·패널 조합 | [viewer-canvas.tsx](app/viewer/viewer-canvas.tsx) |
| 제목·요약 / 3D 표시 마크업 | [viewer-header.tsx](app/viewer/_components/viewer-header.tsx), [viewer-scene-panel.tsx](app/viewer/_components/viewer-scene-panel.tsx) |
| 재생·탐색 / timestamp 선택 | [use-playback.ts](app/viewer/_hooks/use-playback.ts), [find-latest-frame-at-or-before.ts](app/viewer/_data/find-latest-frame-at-or-before.ts) |
| 실제 manifest·LiDAR 로딩 | [load-drivescope-data-source.ts](app/viewer/_data/load-drivescope-data-source.ts) |
| Promise 공유·양옆 prefetch·최대 5개 LRU | [use-lidar-frame-cache.ts](app/viewer/_hooks/use-lidar-frame-cache.ts) |
| 숨겨진 img 준비·decode 후 사진 교체 | [use-buffered-camera-frame.ts](app/viewer/_hooks/use-buffered-camera-frame.ts) |
| Three.js 생성·Buffer 갱신·선택·cleanup | [use-three-viewer.ts](app/viewer/_hooks/use-three-viewer.ts) |
| 가상 시나리오 / 실제 데이터 전처리 | [mock-scenario.ts](app/viewer/_data/mock-scenario.ts), [convert_nuscenes_mini.py](scripts/convert_nuscenes_mini.py) |

포인트 좌표는 Three.js가 재사용하는 Buffer에 반영하고 매 프레임 큰 센서 배열을 React state에 넣지 않습니다. Geometry·Material·Renderer 등 GPU 리소스는 소유한 런타임이 cleanup합니다. React Three Fiber는 사용하지 않습니다.

- [PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md): 분석 목적과 제품 범위
- [ROADMAP.md](docs/ROADMAP.md): 단계별 계획과 배포 후 개선 후보
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): 데이터 흐름·책임·리소스 생명주기
- [DATA_FORMAT.md](docs/DATA_FORMAT.md): v3 manifest·바이너리·좌표 계약
- [PERFORMANCE.md](docs/PERFORMANCE.md): 성능 기준선과 측정 방법
- [PROGRESS.md](docs/PROGRESS.md), [LEARNING_NOTES.md](docs/LEARNING_NOTES.md): 검증 결과와 학습 기록
