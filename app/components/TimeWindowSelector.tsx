import { getPlayableTimeWindows, DateString } from '../lib/availabilityHelpers';

/** Multi-select checkboxes of playable time windows for a date (weekday vs weekend aware). */
export function TimeWindowSelector({
  date,
  selected,
  onChange,
}: {
  date: DateString;
  selected: string[];
  onChange: (windows: string[]) => void;
}) {
  const options = getPlayableTimeWindows(date);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((window) => window !== value));
    else onChange([...selected, value]);
  };

  return (
    <div className="time-window-selector">
      {options.map((option) => (
        <label
          key={option.value}
          className={`time-window-option ${selected.includes(option.value) ? 'selected' : ''}`}
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => toggle(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
