# DriveScope 디스크 포맷 v3

이 문서는 nuScenes mini를 변환하는 Python 코드와 브라우저의 TypeScript 로더가 공유할 현재 디스크 계약을 정의한다. v2는 실제 ego vehicle pose를 추가했고, v3는 좌우 반전을 일으키던 축 변환을 오른손 좌표계로 수정한다. v2와 파일 구조는 같지만 좌표와 yaw의 의미가 다르므로 v2 파일의 버전 숫자만 바꾸면 안 된다. 원본에서 다시 변환하거나 v3 산출물을 복사해야 한다. 현재 로더는 v3만 허용한다.

## 디렉터리 구조

한 시나리오는 다음처럼 독립된 디렉터리 하나로 출력한다.

```text
scenario-id/
├─ manifest.json
├─ camera/
│  ├─ 000000.jpg
│  └─ 000500.jpg
└─ lidar/
   ├─ 000000.bin
   └─ 000500.bin
```

`manifest.json` 안의 파일 경로는 manifest가 있는 디렉터리를 기준으로 한 POSIX 상대 경로다. 절대 경로, URL, `..`, 역슬래시, query와 fragment는 허용하지 않는다. 따라서 Python이 만든 디렉터리를 정적 파일 위치로 옮겨도 manifest 내용을 다시 쓸 필요가 없다.

## manifest

TypeScript 계약과 런타임 검증 함수는 `app/viewer/_data/drivescope-manifest.ts`에 있다. `fixtures/drivescope-manifest.json`은 파일 형식만 검증하는 작은 가상 입력이며, 참조한 이미지와 LiDAR 파일을 실제로 포함하는 데이터 세트는 아니다.

주요 필드는 다음과 같다.

- `schemaVersion`: 현재 포맷 버전 `3`
- `coordinateSystem`: `x-right-y-up-z-backward-meters`
- `scenarioId`: DriveScope에서 사용할 시나리오 ID
- `durationMs`: 마지막으로 재생할 수 있는 상대 시각
- `source.timestampOriginUs`: 시나리오 시작에 해당하는 원본 nuScenes timestamp. JSON 정밀도와 언어별 정수 처리 차이를 피하려고 문자열로 저장한다.
- `lidar.frames[].positionsFile`: 변환된 LiDAR 좌표 바이너리의 상대 경로
- `lidar.frames[].pointCount`: 바이너리에 들어 있는 포인트 수
- `camera.frames[].imageFile`: 전방 카메라 이미지의 상대 경로
- `egoVehicle.frames[].position`: 첫 LiDAR ego pose 기준의 실제 차량 위치 `[x, y, z]`
- `egoVehicle.frames[].yawRadians`: Viewer의 Y축을 기준으로 한 실제 차량 진행 방향
- 각 Frame의 `timestampMs`: 시나리오 시작 기준의 정수 밀리초

LiDAR, Camera와 ego vehicle Frame 배열은 `timestampMs` 오름차순이어야 하며 모든 timestamp는 `0` 이상 `durationMs` 이하여야 한다. 현재 ego vehicle Frame은 변환된 LiDAR keyframe과 같은 timestamp를 사용한다. `position`과 `yawRadians`는 유한한 숫자여야 한다.

## timestamp 변환

`timestampOriginUs`는 변환 대상인 첫 LiDAR·전방 카메라 Frame 가운데 가장 이른 원본 timestamp다. 각 센서의 원본 microsecond timestamp를 다음 규칙으로 변환한다.

```text
timestampMs = floor((sourceTimestampUs - timestampOriginUs) / 1000)
```

소수 밀리초는 버려 Python과 TypeScript가 같은 정수 결과를 얻는다. `durationMs`는 포함된 모든 센서 Frame의 가장 큰 `timestampMs`다.

## LiDAR 바이너리

`positionEncoding`은 `float32-le-xyz`다.

- 포인트 하나는 `x`, `y`, `z` 순서의 little-endian IEEE 754 Float32 세 개다.
- 포인트 하나의 크기는 12바이트다.
- 파일 크기는 반드시 `pointCount × 3 × 4`바이트여야 한다.
- intensity, ring index와 원본 nuScenes의 추가 성분은 v3에 저장하지 않는다.
- JSON에 좌표를 펼치지 않아 JSON 파싱 비용과 문자열 크기를 피한다.

브라우저 로더는 `ArrayBuffer`의 바이트 길이를 먼저 검사한 뒤 Float32 좌표로 해석하며 실제 HTTP 로더에 이 검사가 연결되어 있다.

## 좌표계

모든 LiDAR 좌표는 Viewer가 직접 사용할 수 있는 오른손 좌표계로 미리 변환한다.

- X: 오른쪽
- Y: 위
- Z: 뒤 (전방은 -Z)
- 거리 단위: meter
- 원점: 시나리오 첫 sample의 ego vehicle 위치

nuScenes ego 좌표의 `x=앞, y=왼쪽, z=위`를 Viewer 축으로 옮길 때는 먼저 센서 보정과 ego pose를 적용하고, 첫 sample 기준 시나리오 좌표로 바꾼 뒤 `viewerX = -sourceY`, `viewerY = sourceZ`, `viewerZ = -sourceX` 규칙을 적용한다. 변환 행렬의 determinant는 +1이며 오른손성을 유지한다. v2의 Z 부호는 +였고 determinant가 -1인 반사 변환이었다. 이 변환은 Python 변환기의 책임이며 브라우저는 manifest의 좌표를 다시 회전하지 않는다. 카메라 JPEG는 원본 그대로 복사하며 이미지를 뒤집지 않는다.

이 계약은 실제 디스크 데이터에 적용한다. 기존 가상 시나리오는 +Z 전방 규칙과 고정 Camera를 그대로 사용하므로 실제 v3 데이터와 섞지 않는다.

## Ego vehicle pose

LiDAR 점을 공통 시나리오 좌표로 옮길 때 사용한 각 시점의 `ego_pose`를 버리지 않고 `egoVehicle.frames`에도 기록한다. 첫 LiDAR ego pose의 역변환을 적용하므로 첫 ego Frame의 위치와 yaw는 부동소수점 오차 범위에서 `[0, 0, 0]`, `0`이다. 이후 Frame의 위치와 yaw는 첫 차량 기준으로 얼마나 이동하고 회전했는지를 뜻한다.

v3의 yaw 0은 -Z 전방이다. 변환된 전방 벡터에서 `atan2(-forwardX, -forwardZ)`로 yaw를 구하면 Three.js의 `rotation.y`에 직접 사용할 수 있다. yaw에서 재구성한 수평 전방 벡터는 `[-sin(yaw), 0, -cos(yaw)]`이며 추적 Camera도 같은 벡터를 사용한다.

현재 포맷은 nuScenes에서 직접 확인한 pose만 저장한다. 속도와 가속도는 별도 CAN bus 원본이나 명시적인 계산 규칙 없이 추정하지 않는다. Viewer 연결 단계에서는 위치와 yaw로 실제 차량 Mesh를 움직이고, 속도·가속도가 필요해질 때 데이터 출처와 계산 기준을 먼저 정한다.

## 검증

### nuScenes mini 첫 scene 변환

Python 3.12 환경에서 공식 devkit을 프로젝트 가상환경에 설치한다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-converter.txt
```

원본 데이터 루트와 변환 결과를 둘 출력 루트를 지정한다. 기본 `scene-index`는 첫 scene인 `0`이며 출력 루트 아래에 nuScenes scene 이름의 디렉터리를 만든다. 같은 scene 디렉터리가 이미 있으면 기존 결과를 덮어쓰지 않는다.

```powershell
.\.venv\Scripts\python.exe scripts\convert_nuscenes_mini.py `
  --dataroot "<nuScenes mini 루트>" `
  --output-root "<DriveScope 변환 출력 루트>" `
  --scene-index 0
```

기본 변환은 scene의 sample keyframe `LIDAR_TOP`과 `CAM_FRONT`, LiDAR keyframe 시점의 ego vehicle pose를 출력한다. 좌표 기준은 첫 sample의 LiDAR ego pose이고 timestamp origin은 포함한 LiDAR·Camera Frame 중 가장 이른 원본 timestamp다.

### 중간 sweep 비교 옵션

`--include-sweeps`를 추가하면 각 센서의 첫/마지막 keyframe 사이 `sample_data.next`를 따라 중간 LiDAR·CAM_FRONT를 개별 Frame으로 출력한다. LiDAR sweep마다 자신의 calibration과 ego pose를 적용하고 같은 시각의 ego Frame을 기록한다. scene-0061에서는 LiDAR 382개·Camera 224개·ego 382개이며 duration은 그대로 19185ms다. 센서 배열 인덱스로 시간을 묶지 않는다.

```powershell
.\.venv\Scripts\python.exe scripts\convert_nuscenes_mini.py `
  --dataroot "<nuScenes mini 루트>" `
  --output-root "<새 개별 sweep 출력 루트>" --include-sweeps
# 비교용 누적은 반드시 다른 새 출력 루트를 쓴다.
.\.venv\Scripts\python.exe scripts\convert_nuscenes_mini.py `
  --dataroot "<nuScenes mini 루트>" `
  --output-root "<새 누적 출력 루트>" --include-sweeps --lidar-sweeps 5
```

누적은 현재와 직전 최대 N-1개만 사용한다. 각각을 공통 첫 LiDAR ego 기준 좌표로 변환한 뒤 이어 붙이며, 시작 시 부족한 과거는 실제 존재하는 만큼만 사용한다. 미래·scene 이전 sweep을 섞지 않는다. 센서/자차 이동 보정은 움직이는 객체의 이동 보정이 아니므로 과거 객체 점이 남는다. [공식 devkit의 multisweep 좌표 변환](https://github.com/nutonomy/nuscenes-devkit/blob/master/python-sdk/nuscenes/utils/data_classes.py)

v3 manifest·바이너리 계약은 같다. sweep 옵션은 별도 `conversion.json`에 개수·시간 창·객체 이동 보정 없음·포인트별 시각 저장 없음도 기록한다. Viewer는 이 sidecar를 읽지 않으므로 누적 파일을 단일 시각의 관측으로 해석하지 말아야 한다. 포인트별 시간 분석은 원본/비교 기록을 사용한다.

**채택 범위는 개별 sweep의 명시적 변환 옵션이다.** 기본 변환과 공개 Viewer는 keyframe을 유지한다. 5개 누적은 비교용이며 기본값으로 채택하지 않는다. 현재 Viewer의 재생 갱신은 100ms여서 약 50ms 간격의 모든 LiDAR Frame을 표시하지 않는다. 50ms 주기는 브라우저 비교용 주입만 실행했다. [수치·제약·재현](./PERFORMANCE.md#sweeps-비교와-포함-결정-ps-6)

### 산출물 검증

```bash
pnpm validate:manifest
```

이 명령은 fixture JSON을 실제로 읽고 `parseDriveScopeManifest()`로 검사한다. TypeScript 타입은 컴파일 시 코드만 검사하므로, Python이 만든 외부 JSON에는 같은 런타임 검증이 필요하다.

실제 변환 결과는 manifest 경로를 추가로 넘긴다. schema와 timestamp·경로에 더해 카메라 파일 존재 여부와 LiDAR 바이너리 크기를 검증한다.

```powershell
pnpm validate:manifest "<변환 scene 디렉터리>\manifest.json"
```
