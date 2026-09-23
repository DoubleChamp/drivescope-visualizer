import type { ObjectDetection, ObjectDetectionFrame } from "../_data/frame-types";
import styles from "../viewer-canvas.module.css";

type SelectedObjectPanelProps = {
  object: ObjectDetection | null;
  frame: ObjectDetectionFrame | null;
};

export function SelectedObjectPanel({
  object,
  frame,
}: SelectedObjectPanelProps) {
  return (
    <section className={styles.selectedObject} aria-label="선택한 객체 정보">
      <h2>선택한 객체</h2>
      {object ? (
        <dl className={styles.selectedObjectDetails}>
          <div>
            <dt>ID</dt>
            <dd>{object.id}</dd>
          </div>
          <div>
            <dt>종류</dt>
            <dd>{object.category === "pedestrian" ? "보행자" : "차량"}</dd>
          </div>
          <div>
            <dt>신뢰도</dt>
            <dd>{(object.confidence * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt>크기 (너비 × 길이 × 높이)</dt>
            <dd>{object.size.map((value) => `${value.toFixed(1)}m`).join(" × ")}</dd>
          </div>
          <div>
            <dt>인식 시각</dt>
            <dd>{((frame?.timestampMs ?? 0) / 1_000).toFixed(1)}초</dd>
          </div>
        </dl>
      ) : (
        <p>3D 장면에서 보행자 박스를 클릭하세요.</p>
      )}
    </section>
  );
}
