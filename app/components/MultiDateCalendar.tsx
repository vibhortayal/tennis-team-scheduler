import { useMemo, useState } from 'react';
import {
  normalizeDate,
  getDateState,
  getDisabledReasonLabel,
  isDateDisabled,
  DateString,
  DayAvailability,
  DayBlock,
  DateState,
  DisabledReason,
  PickerType,
} from '../lib/availabilityHelpers';

interface MultiDateCalendarProps {
  selectedDates: DateString[];
  onDateToggle: (date: DateString) => void;
  availabilityMap: Map<DateString, DayAvailability>;
  blockingMap: Map<DateString, DayBlock>;
  matchDates: DateString[];
  pickerType: PickerType;
  minDate?: Date;
  maxDate?: Date;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export function MultiDateCalendar({
  selectedDates,
  onDateToggle,
  availabilityMap,
  blockingMap,
  matchDates,
  pickerType,
  minDate,
  maxDate,
}: MultiDateCalendarProps) {
  const today = startOfDay(new Date());
  const rangeStart = minDate ? startOfDay(minDate) : today;
  const rangeEnd = maxDate
    ? startOfDay(maxDate)
    : new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(rangeStart));

  const getDateInfo = (date: Date) => {
    const dateStr = normalizeDate(date);
    return getDateState(pickerType, dateStr, availabilityMap, blockingMap, matchDates);
  };

  const handleDateClick = (date: Date) => {
    const info = getDateInfo(date);
    if (isDateDisabled(info.state)) return;
    onDateToggle(normalizeDate(date));
  };

  const canGoPrev = startOfMonth(viewMonth) > startOfMonth(rangeStart);
  const canGoNext = startOfMonth(viewMonth) < startOfMonth(rangeEnd);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    viewMonth
  );

  return (
    <div className="multi-date-calendar">
      <div className="calendar-nav">
        <button
          type="button"
          className="secondary"
          disabled={!canGoPrev}
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <b>{monthLabel}</b>
        <button
          type="button"
          className="secondary"
          disabled={!canGoNext}
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <CalendarGrid
        viewMonth={viewMonth}
        selectedDates={selectedDates}
        onDateToggle={handleDateClick}
        getDateInfo={getDateInfo}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
    </div>
  );
}

interface CalendarGridProps {
  viewMonth: Date;
  selectedDates: DateString[];
  onDateToggle: (date: Date) => void;
  getDateInfo: (date: Date) => { state: DateState; disabledReason: DisabledReason };
  rangeStart: Date;
  rangeEnd: Date;
}

function CalendarGrid({
  viewMonth,
  selectedDates,
  onDateToggle,
  getDateInfo,
  rangeStart,
  rangeEnd,
}: CalendarGridProps) {
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const gridEnd = new Date(monthEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    const days: (Date | null)[] = [];
    for (
      let cursor = new Date(gridStart);
      cursor <= gridEnd;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const inMonth = cursor.getMonth() === viewMonth.getMonth();
      const inRange = cursor >= rangeStart && cursor <= rangeEnd;
      days.push(inMonth && inRange ? new Date(cursor) : null);
    }
    const result: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [viewMonth, rangeStart, rangeEnd]);

  return (
    <div className="calendar-grid">
      <div className="calendar-header">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="calendar-week">
          {week.map((date, dayIndex) => (
            <CalendarDay
              key={dayIndex}
              date={date}
              selectedDates={selectedDates}
              onDateToggle={onDateToggle}
              getDateInfo={getDateInfo}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CalendarDayProps {
  date: Date | null;
  selectedDates: DateString[];
  onDateToggle: (date: Date) => void;
  getDateInfo: (date: Date) => { state: DateState; disabledReason: DisabledReason };
}

function CalendarDay({ date, selectedDates, onDateToggle, getDateInfo }: CalendarDayProps) {
  if (!date) {
    return <div className="calendar-day empty" aria-hidden="true" />;
  }

  const dateStr = normalizeDate(date);
  const isSelected = selectedDates.includes(dateStr);
  const info = getDateInfo(date);
  const disabled = isDateDisabled(info.state);
  const reasonLabel = getDisabledReasonLabel(info.disabledReason);
  const stateLabel = isSelected
    ? 'Selected'
    : info.state === 'available' || info.state === 'available-anytime'
      ? 'Available'
      : info.state === 'blocked' || info.state === 'blocked-all-day'
        ? 'Blocked'
        : info.state === 'match'
          ? 'Match day'
          : 'Selectable';
  const title = reasonLabel ? `${formatTitle(date)} · ${reasonLabel}` : formatTitle(date);

  return (
    <button
      type="button"
      className={`calendar-day state-${info.state} ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onDateToggle(date)}
      disabled={disabled}
      title={title}
      aria-label={`${formatTitle(date)}, ${stateLabel}${reasonLabel ? `, ${reasonLabel}` : ''}`}
    >
      <span className="date-number">{date.getDate()}</span>
      {reasonLabel && <span className="date-label">{reasonLabel}</span>}
    </button>
  );
}

const formatTitle = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    date
  );

export function DateStateLegend({ pickerType }: { pickerType: PickerType }) {
  return (
    <div className="date-state-legend">
      <div className="legend-items">
        <div className="legend-item">
          <div className="legend-color state-normal" />
          <span>Selectable</span>
        </div>
        <div className="legend-item">
          <div className="legend-color state-available" />
          <span>
            {pickerType === 'availability' ? 'Selected (available)' : 'Available anytime'}
          </span>
        </div>
        <div className="legend-item">
          <div className="legend-color state-blocked" />
          <span>{pickerType === 'blocking' ? 'Selected (blocked)' : 'Blocked'}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color state-match" />
          <span>Match day</span>
        </div>
        {pickerType === 'availability' && (
          <div className="legend-item">
            <div className="legend-color state-blocked-all-day" />
            <span>Blocked all day (disabled)</span>
          </div>
        )}
        {pickerType === 'blocking' && (
          <div className="legend-item">
            <div className="legend-color state-available-anytime" />
            <span>Available anytime (disabled)</span>
          </div>
        )}
      </div>
    </div>
  );
}
