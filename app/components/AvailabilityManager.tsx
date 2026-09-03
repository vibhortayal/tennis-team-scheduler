import { FormEvent, useState } from 'react';
import { AvailabilitySlot, SEASON_DEADLINE_DATE } from '../lib/scheduling';
export type { AvailabilitySlot } from '../lib/scheduling';

type TimeRange = { start: string; end: string };
type AvailabilityManagerProps = {
  slots: AvailabilitySlot[];
  deadline: string;
  scheduledDates: string[];
  scheduledTimes: Array<{ date: string; startsAt: string; endsAt: string }>;
  saving: boolean;
  error: string;
  onSave: (startsAt: string, endsAt: string, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBlock: (startsAt: string, endsAt: string) => Promise<void>;
};

const localParts = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
};
const today = () => localParts(new Date().toISOString()).date;
const dayOffset = (dateText: string, offset: number) => {
  const date = new Date(`${dateText}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return localParts(date.toISOString()).date;
};

export function AvailabilityManager({
  slots,
  deadline,
  scheduledDates,
  scheduledTimes,
  saving,
  error,
  onSave,
  onDelete,
  onBlock,
}: AvailabilityManagerProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'available' | 'blocked'>('available');
  const [dates, setDates] = useState<string[]>([]);
  const [timePlan, setTimePlan] = useState<'blanket' | 'daily'>('blanket');
  const [blanket, setBlanket] = useState<TimeRange>({ start: '', end: '' });
  const [daily, setDaily] = useState<Record<string, TimeRange>>({});
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState('');
  const maxDate = SEASON_DEADLINE_DATE;
  const timeOptions = Array.from({ length: 27 }, (_, index) => {
    const minutes = 7 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });

  const reset = () => {
    setStep(1);
    setDates([]);
    setBlanket({ start: '', end: '' });
    setDaily({});
    setEditingId(undefined);
    setFormError('');
  };
  const formatDate = (value: Date) => {
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  };
  const calendarDays = Array.from({ length: 28 }, (_, index) => {
    const day = new Date(`${today()}T12:00:00`);
    day.setDate(day.getDate() + index);
    return day;
  }).filter((day) => formatDate(day) <= maxDate);
  const toggleDate = (value: string) => {
    if (dates.includes(value))
      setDates((current) => current.filter((dateValue) => dateValue !== value));
    else setDates((current) => [...current, value].sort());
    setFormError('');
  };
  const rangeFor = (selectedDate: string) =>
    timePlan === 'blanket' ? blanket : daily[selectedDate] || { start: '', end: '' };
  const updateDaily = (selectedDate: string, key: keyof TimeRange, value: string) =>
    setDaily((current) => ({
      ...current,
      [selectedDate]: { ...rangeFor(selectedDate), [key]: value },
    }));
  const asDateTime = (selectedDate: string, time: string) => new Date(`${selectedDate}T${time}`);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dates.length) {
      setFormError('Choose at least one date first.');
      setStep(1);
      return;
    }
    const windows: Array<{ startsAt: string; endsAt: string }> = [];
    for (const selectedDate of dates) {
      const range = rangeFor(selectedDate);
      const start = asDateTime(selectedDate, range.start);
      const end = asDateTime(selectedDate, range.end);
      if (!range.start || !range.end || end <= start || start <= new Date()) {
        setFormError(`Choose a valid future time for ${selectedDate}.`);
        return;
      }
      if (end > new Date(deadline)) {
        setFormError('Times must end by September 30, 2026.');
        return;
      }
      const conflict = scheduledTimes.some(
        (scheduled) =>
          scheduled.date === selectedDate &&
          start < asDateTime(selectedDate, scheduled.endsAt) &&
          end > asDateTime(selectedDate, scheduled.startsAt)
      );
      if (conflict) {
        setFormError(`That time overlaps a scheduled match on ${selectedDate}. Pick another time.`);
        return;
      }
      windows.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    }
    setFormError('');
    for (const window of windows) {
      if (mode === 'blocked') await onBlock(window.startsAt, window.endsAt);
      else await onSave(window.startsAt, window.endsAt, editingId);
    }
    reset();
  };

  const edit = (slot: AvailabilitySlot) => {
    const start = localParts(slot.startsAt);
    const end = localParts(slot.endsAt);
    setMode('available');
    setEditingId(slot.id);
    setDates([start.date]);
    setBlanket({ start: start.time, end: end.time });
    setStep(3);
    setFormError('');
  };
  const selectMode = (nextMode: 'available' | 'blocked') => {
    reset();
    setMode(nextMode);
  };
  const nearbyMatchNote = (dateText: string) => {
    const notes = [];
    if (scheduledDates.includes(dayOffset(dateText, -1))) notes.push('Match previous day');
    if (scheduledDates.includes(dateText)) notes.push('Match today');
    if (scheduledDates.includes(dayOffset(dateText, 1))) notes.push('Match next day');
    return notes.join(' · ');
  };

  return (
    <div className="availability-manager">
      <h3>{mode === 'blocked' ? 'Blocked dates' : 'Available dates'}</h3>
      <p>
        We&apos;ll walk you through it. You can select several dates and add more than one window on
        each date.
      </p>
      {(formError || error) && <p className="error-note">{formError || error}</p>}
      <div className="availability-modes" role="tablist" aria-label="Availability action">
        <button
          type="button"
          className={mode === 'available' ? '' : 'secondary'}
          onClick={() => selectMode('available')}
        >
          Available dates
        </button>
        <button
          type="button"
          className={mode === 'blocked' ? 'block-mode' : 'secondary'}
          onClick={() => selectMode('blocked')}
        >
          Blocked dates
        </button>
      </div>
      {step === 1 && (
        <div className="availability-step">
          <h4>Which dates work?</h4>
          <p>
            Select as many dates as you like. Scheduled match dates are okay; only their match time
            is protected.
          </p>
          <div className="date-checklist" aria-label="Select available dates">
            <strong>Upcoming dates through September 30</strong>
            <div className="date-options">
              {calendarDays.map((calendarDay) => {
                const value = formatDate(calendarDay);
                const selected = dates.includes(value);
                return (
                  <label key={value} className={`date-option ${selected ? 'selected' : ''}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleDate(value)} />
                    <span>
                      <b>{calendarDay.toLocaleDateString('en-US', { weekday: 'short' })}</b>{' '}
                      {calendarDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {nearbyMatchNote(value) && <small>{nearbyMatchNote(value)}</small>}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="selected-dates">
            {dates.map((selectedDate) => (
              <button
                type="button"
                className="date-chip"
                key={selectedDate}
                onClick={() =>
                  setDates((current) => current.filter((value) => value !== selectedDate))
                }
              >
                {selectedDate}
                {nearbyMatchNote(selectedDate) ? ` · ${nearbyMatchNote(selectedDate)}` : ''}{' '}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <div className="assistant-actions">
            <span />
            <button type="button" disabled={!dates.length} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="availability-step">
          <h4>Do these dates share a time?</h4>
          <p>
            Use one blanket time if your schedule is consistent, or choose different times day by
            day.
          </p>
          <div className="choice-list">
            <label>
              <input
                type="radio"
                checked={timePlan === 'blanket'}
                onChange={() => setTimePlan('blanket')}
              />{' '}
              Same time on every selected date
            </label>
            <label>
              <input
                type="radio"
                checked={timePlan === 'daily'}
                onChange={() => setTimePlan('daily')}
              />{' '}
              Different time on each date
            </label>
          </div>
          <div className="assistant-actions">
            <button type="button" className="secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <form id="availability-form" className="availability-step" onSubmit={submit}>
          <h4>{timePlan === 'blanket' ? 'What time works?' : 'Set each day&apos;s time'}</h4>
          {timePlan === 'blanket' ? (
            <div className="time-row">
              <TimeSelect
                label="From"
                value={blanket.start}
                options={timeOptions.slice(0, -1)}
                onChange={(value) => setBlanket((current) => ({ ...current, start: value }))}
              />
              <TimeSelect
                label="Until"
                value={blanket.end}
                options={timeOptions.slice(1)}
                onChange={(value) => setBlanket((current) => ({ ...current, end: value }))}
              />
            </div>
          ) : (
            <div className="daily-times">
              {dates.map((selectedDate) => (
                <div className="daily-time" key={selectedDate}>
                  <b>{selectedDate}</b>
                  <TimeSelect
                    label="From"
                    value={rangeFor(selectedDate).start}
                    options={timeOptions.slice(0, -1)}
                    onChange={(value) => updateDaily(selectedDate, 'start', value)}
                  />
                  <TimeSelect
                    label="Until"
                    value={rangeFor(selectedDate).end}
                    options={timeOptions.slice(1)}
                    onChange={(value) => updateDaily(selectedDate, 'end', value)}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="assistant-actions">
            <button type="button" className="secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button disabled={saving}>
              {mode === 'blocked'
                ? 'Block selected times'
                : editingId
                  ? 'Update time'
                  : 'Save selected times'}
            </button>
          </div>
        </form>
      )}
      {scheduledDates.length > 0 && (
        <p className="availability-note">
          Scheduled dates still allow other times: {scheduledDates.join(', ')}.
        </p>
      )}
      {slots.length > 0 && (
        <ul className="availability-list">
          {slots.map((slot) => {
            const start = localParts(slot.startsAt);
            const end = localParts(slot.endsAt);
            return (
              <li key={slot.id}>
                <span>
                  {start.date} · {start.time} - {end.time}
                  {nearbyMatchNote(start.date) && (
                    <small className="availability-adjacent">{nearbyMatchNote(start.date)}</small>
                  )}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select time</option>
        {options.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
    </label>
  );
}
