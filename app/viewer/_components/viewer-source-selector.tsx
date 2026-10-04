import styles from "../viewer-canvas.module.css";

export type ViewerMode = "actual" | "mock";

type ViewerSourceSelectorProps = {
  mode: ViewerMode;
  onChange: (mode: ViewerMode) => void;
};

const OPTIONS = [
  { value: "actual", label: "실제 센서 로그" },
  { value: "mock", label: "가상 급제동 데모" },
] as const;

export function ViewerSourceSelector({ mode, onChange }: ViewerSourceSelectorProps) {
  return (
    <fieldset className={styles.sourceSelector}>
      <legend>데모 선택</legend>
      <div className={styles.sourceOptions}>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={styles.sourceOption}
            data-selected={mode === option.value}
          >
            <input
              type="radio"
              name="viewer-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
