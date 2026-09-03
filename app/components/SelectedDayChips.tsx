import { formatDateDisplay, formatWindowLabel, DateString } from '../lib/availabilityHelpers';

export type SelectedDayChipEntry = {
  date: DateString;
  modeLabel: string;
  timeWindows?: string[];
  onRemove: () => void;
  onEdit?: () => void;
};

/** Compact chip/card list of selected dates, sorted chronologically. */
export function SelectedDayChips({ entries }: { entries: SelectedDayChipEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  if (!sorted.length) return null;

  return (
    <ul className="selected-day-chips">
      {sorted.map((entry) => (
        <li key={entry.date} className="selected-day-chip">
          <div className="selected-day-chip-info">
            <b>{formatDateDisplay(entry.date)}</b>
            <span>{entry.modeLabel}</span>
            {entry.timeWindows && entry.timeWindows.length > 0 && (
              <span className="selected-day-chip-windows">
                {entry.timeWindows.map(formatWindowLabel).join(', ')}
              </span>
            )}
          </div>
          <div className="selected-day-chip-actions">
            {entry.onEdit && (
              <button type="button" className="secondary" onClick={entry.onEdit}>
                Edit
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={entry.onRemove}
              aria-label={`Remove ${formatDateDisplay(entry.date)}`}
            >
              <span aria-hidden="true">×</span> Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
