import { FormEvent, useState } from 'react';
import { AvailabilitySlot } from '../lib/scheduling';
export type { AvailabilitySlot } from '../lib/scheduling';

type AvailabilityManagerProps = {
  slots: AvailabilitySlot[];
  deadline: string;
  saving: boolean;
  error: string;
  onSave: (startsAt: string, endsAt: string, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkSave: (windows: Array<{ startsAt: string; endsAt: string }>) => Promise<void>;
  onBlock: (startsAt: string, endsAt: string) => Promise<void>;
};

const localValue = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function AvailabilityManager({
  slots,
  deadline,
  saving,
  error,
  onSave,
  onDelete,
  onBulkSave,
  onBlock,
}: AvailabilityManagerProps) {
  const [mode, setMode] = useState<'single' | 'recurring' | 'block'>('recurring');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [days, setDays] = useState<number[]>([0, 6]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!startsAt || !endsAt || Number.isNaN(start.valueOf()) || end <= start) {
      setFormError('End time must be after start time.');
      return;
    }
    if (start <= new Date()) {
      setFormError('Availability must start in the future.');
      return;
    }
    if (end > new Date(deadline)) {
      setFormError('Availability must end by September 30, 2026.');
      return;
    }
    setFormError('');
    await onSave(start.toISOString(), end.toISOString(), editingId);
    setStartsAt('');
    setEndsAt('');
    setEditingId(undefined);
  };

  const edit = (slot: AvailabilitySlot) => {
    setMode('single');
    setEditingId(slot.id);
    setStartsAt(localValue(slot.startsAt));
    setEndsAt(localValue(slot.endsAt));
    setFormError('');
  };

  const submitRecurring = async (event: FormEvent) => {
    event.preventDefault();
    const start = new Date(`${rangeStart}T00:00:00`);
    const end = new Date(`${rangeEnd}T00:00:00`);
    const [startTime, endTime] = [startsAt, endsAt];
    if (!rangeStart || !rangeEnd || end < start || !days.length || !startTime || !endTime) {
      setFormError('Choose a date range, at least one day, and a time window.');
      return;
    }
    const windows: Array<{ startsAt: string; endsAt: string }> = [];
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (!days.includes(date.getDay())) continue;
      const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const windowStart = new Date(`${dateText}T${startTime}`);
      const windowEnd = new Date(`${dateText}T${endTime}`);
      if (windowEnd > windowStart && windowEnd > new Date() && windowEnd <= new Date(deadline)) {
        windows.push({ startsAt: windowStart.toISOString(), endsAt: windowEnd.toISOString() });
      }
    }
    if (!windows.length) {
      setFormError('That range has no future windows before the deadline.');
      return;
    }
    setFormError('');
    await onBulkSave(windows);
    setRangeStart('');
    setRangeEnd('');
  };

  const submitBlock = async (event: FormEvent) => {
    event.preventDefault();
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!startsAt || !endsAt || end <= start) {
      setFormError('End time must be after start time.');
      return;
    }
    if (start <= new Date() || end > new Date(deadline)) {
      setFormError('Choose a future time before September 30, 2026.');
      return;
    }
    setFormError('');
    await onBlock(start.toISOString(), end.toISOString());
    setStartsAt('');
    setEndsAt('');
  };

  return (
    <div className="availability-manager">
      <h3>Your availability</h3>
      <p>Set a pattern once, or block a time you cannot make. Times use your local timezone.</p>
      {(formError || error) && <p className="error-note">{formError || error}</p>}
      <div className="availability-modes" role="tablist" aria-label="Availability actions">
        <button
          type="button"
          className={mode === 'recurring' ? '' : 'secondary'}
          onClick={() => setMode('recurring')}
        >
          Add a pattern
        </button>
        <button
          type="button"
          className={mode === 'single' ? '' : 'secondary'}
          onClick={() => setMode('single')}
        >
          Add one time
        </button>
        <button
          type="button"
          className={mode === 'block' ? 'block-mode' : 'secondary'}
          onClick={() => setMode('block')}
        >
          Block unavailable
        </button>
      </div>
      {mode === 'recurring' && (
        <form className="availability-form recurring-form" onSubmit={submitRecurring}>
          <label className="field">
            From
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Through
            <input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              required
            />
          </label>
          <div className="field day-picker">
            <span>Days</span>
            <div>
              {dayNames.map((name, day) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={days.includes(day)}
                    onChange={() =>
                      setDays((current) =>
                        current.includes(day)
                          ? current.filter((value) => value !== day)
                          : [...current, day]
                      )
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>
          <label className="field">
            Start time
            <input
              type="time"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            End time
            <input
              type="time"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </label>
          <button disabled={saving}>Add these times</button>
        </form>
      )}
      {mode === 'block' && (
        <form className="availability-form" onSubmit={submitBlock}>
          <label className="field">
            Unavailable from
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            Unavailable until
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </label>
          <button className="block-mode" disabled={saving}>
            Block this time
          </button>
        </form>
      )}
      {mode === 'single' && (
        <form className="availability-form" onSubmit={submit}>
          <label className="field">
            Start
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            End
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </label>
          <button disabled={saving}>{editingId ? 'Update window' : 'Add another time'}</button>
          {editingId && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditingId(undefined);
                setStartsAt('');
                setEndsAt('');
              }}
            >
              Cancel edit
            </button>
          )}
        </form>
      )}
      {slots.length === 0 ? (
        <p className="empty">No availability added yet.</p>
      ) : (
        <ul className="availability-list">
          {slots.map((slot) => (
            <li key={slot.id}>
              <span>
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'America/Los_Angeles',
                }).format(new Date(slot.startsAt))}{' '}
                -{' '}
                {new Intl.DateTimeFormat('en-US', {
                  timeStyle: 'short',
                  timeZone: 'America/Los_Angeles',
                }).format(new Date(slot.endsAt))}
              </span>
              <span className="availability-actions">
                <button type="button" className="secondary" onClick={() => edit(slot)}>
                  Edit
                </button>
                <button type="button" className="secondary" onClick={() => onDelete(slot.id)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
