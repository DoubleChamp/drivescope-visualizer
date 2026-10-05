import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PerspectiveCamera, Vector3 } from "three";

// 실제 TS 함수와 Three.js Camera로 시간 간격별 이동을 검증한다. DOM·센서 파일은 쓰지 않는다.
const module = { exports: {} };
const { outputText } = ts.transpileModule(
  readFileSync("app/viewer/_utils/damp-follow-camera.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
);
new Function("module", "exports", outputText)(module, module.exports);
const { dampFollowCamera } = module.exports;
const targetPosition = new Vector3(10, 12, 18);
const targetLookAt = new Vector3(10, 1.5, -12);
const createView = () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 12, 18);
  const lookAt = new Vector3(0, 1.5, -12);
  camera.lookAt(lookAt);
  return { camera, lookAt };
};
const advance = (view, dt) => dampFollowCamera(
  view.camera, view.lookAt, targetPosition, targetLookAt, dt,
);
const simulate = intervals => {
  const view = createView();
  let previousX = 0;
  for (const dt of intervals) {
    advance(view, dt);
    assert(view.camera.position.x >= previousX && view.camera.position.x <= 10,
      "시점은 목표를 향해 이동하며 지나치거나 되돌아가지 않아야 합니다.");
    assert(view.camera.quaternion.toArray().every(Number.isFinite));
    previousX = view.camera.position.x;
  }
  return view;
};

const first = createView();
advance(first, 0);
assert.equal(first.camera.position.x, 0, "경과 시간이 없으면 시점이 움직이지 않습니다.");
advance(first, -1);
assert.equal(first.camera.position.x, 0, "음수 시간은 이동을 만들지 않습니다.");
advance(first, 1 / 60);
assert(first.camera.position.x > 0 && first.camera.position.x < 10,
  "첫 렌더에서 목표로 즉시 뛰지 않아야 합니다.");

const sixty = simulate(Array(60).fill(1 / 60));
const seventyFive = simulate(Array(75).fill(1 / 75));
const irregular = simulate([0.02, 0.06, 0.12, 0.3, 0.5]);
for (const view of [seventyFive, irregular]) {
  assert(sixty.camera.position.distanceTo(view.camera.position) < 1e-10,
    "1초 뒤 위치는 렌더 빈도와 무관해야 합니다.");
  assert(sixty.lookAt.distanceTo(view.lookAt) < 1e-10);
  assert(sixty.camera.quaternion.angleTo(view.camera.quaternion) < 1e-7);
}
assert(sixty.camera.position.distanceTo(targetPosition) < 0.003,
  "목표가 유지되면 시점이 수렴해야 합니다.");
assert(sixty.lookAt.distanceTo(targetLookAt) < 0.003);
console.log("PASS 카메라 추종: 첫 렌더 점진 이동·시간 0/음수·60/75Hz/불규칙 간격 일치·수렴·역행 없음");
