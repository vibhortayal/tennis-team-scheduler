export type DayModeOption<T extends string> = { value: T; label: string };

/** Segmented control for choosing a per-day mode (e.g. anytime vs time windows). */
export function DayModeSelector<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: DayModeOption<T>[];
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <div className="day-mode-selector" role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? '' : 'secondary'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
