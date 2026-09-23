import { useEffect, useState } from "react";
import type { ObjectDetectionFrame } from "../_data/frame-types";

export function useObjectSelection(frame: ObjectDetectionFrame | null) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const selectedObject =
    frame?.objects.find((object) => object.id === selectedObjectId) ?? null;

  useEffect(() => {
    // 선택 state에는 ID만 남기고, 현재 Frame에 그 ID가 사라지면 선택도 해제한다.
    setSelectedObjectId((currentId) =>
      currentId !== null && !frame?.objects.some((object) => object.id === currentId)
        ? null
        : currentId,
    );
  }, [frame]);

  return { selectedObject, selectedObjectId, setSelectedObjectId };
}
