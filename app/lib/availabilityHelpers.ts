import { Match, isBlockingStatus } from './matches';
import { AvailabilitySlot } from './scheduling';

/**
 * Normalized date format: YYYY-MM-DD for consistent handling across timezones
 */
export type DateString = string; // YYYY-MM-DD
export type PickerType = 'availability' | 'blocking';

export type AvailabilityMode = 'anytime' | 'time_windows';
export type BlockingMode = 'all_day' | 'time_windows';

export interface DayAvailability {
  date: DateString;
  mode: AvailabilityMode;
  timeWindows?: string[]; // e.g., ['06:00-09:00', '18:00-22:00']
}

export interface DayBlock {
  date: DateString;
  mode: BlockingMode;
  timeWindows?: string[];
}

export type DateState =
  'normal' | 'available' | 'available-anytime' | 'blocked' | 'blocked-all-day' | 'match';
export type DisabledReason = 'blocked-all-day' | 'available-anytime' | 'match-day' | 'none';

export type TimeWindowOption = { label: string; value: string };

/** Weekday time windows (excluding 9 AM - 6 PM business hours). */
export const WEEKDAY_TIME_WINDOWS: TimeWindowOption[] = [
  { label: 'Morning (6:00–9:00 AM)', value: '06:00-09:00' },
  { label: 'Evening (6:00–10:00 PM)', value: '18:00-22:00' },
];

/** Weekend time windows (full playable day). */
export const WEEKEND_TIME_WINDOWS: TimeWindowOption[] = [
  { label: 'Morning (6:00 AM–12:00 PM)', value: '06:00-12:00' },
  { label: 'Afternoon (12:00–6:00 PM)', value: '12:00-18:00' },
  { label: 'Evening (6:00–10:00 PM)', value: '18:00-22:00' },
];

/** Convert an ISO date string (or Date) to YYYY-MM-DD using local time. */
export const normalizeDate = (isoOrDate: string | Date): DateString => {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Get day of week (0 = Sunday, 6 = Saturday) for a YYYY-MM-DD date. */
export const getDayOfWeek = (dateStr: DateString): number =>
  new Date(`${dateStr}T12:00:00`).getDay();

export const isWeekend = (dateStr: DateString): boolean => {
  const dow = getDayOfWeek(dateStr);
  return dow === 0 || dow === 6;
};

/** Get the playable time-window options for a date (weekday vs weekend). */
export const getPlayableTimeWindows = (dateStr: DateString): TimeWindowOption[] =>
  isWeekend(dateStr) ? WEEKEND_TIME_WINDOWS : WEEKDAY_TIME_WINDOWS;

/** Check whether a "HH:MM-HH:MM" window is one of the valid options for that date. */
export const isValidTimeWindow = (dateStr: DateString, windowValue: string): boolean =>
  getPlayableTimeWindows(dateStr).some((option) => option.value === windowValue);

const toMinutes = (timeStr: string) => {
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
};

/** Check if two "HH:MM-HH:MM" time windows overlap. */
export const doTimeWindowsOverlap = (window1: string, window2: string): boolean => {
  const [start1Str, end1Str] = window1.split('-');
  const [start2Str, end2Str] = window2.split('-');
  const start1 = toMinutes(start1Str);
  const end1 = toMinutes(end1Str);
  const start2 = toMinutes(start2Str);
  const end2 = toMinutes(end2Str);
  return !(end1 <= start2 || end2 <= start1);
};

/** Format a "HH:MM-HH:MM" window for display, e.g. "6:00 AM – 9:00 AM". */
export const formatWindowLabel = (window: string): string => {
  const [start, end] = window.split('-');
  const label = (time: string) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
      new Date(`2000-01-01T${time}:00`)
    );
  return `${label(start)} – ${label(end)}`;
};

/** Format a date string for display (e.g., "Sat, Sep 12"). */
export const formatDateDisplay = (dateStr: DateString): string =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(`${dateStr}T12:00:00`)
  );

/** ISO bounds representing the full playable day for "anytime"/"all day" entries. */
export const fullDayWindow = (dateStr: DateString): { startsAt: string; endsAt: string } => ({
  startsAt: new Date(`${dateStr}T00:00:00`).toISOString(),
  endsAt: new Date(`${dateStr}T23:59:59.999`).toISOString(),
});

/** Convert a date + "HH:MM-HH:MM" window into ISO start/end bounds. */
export const windowToIso = (
  dateStr: DateString,
  window: string
): { startsAt: string; endsAt: string } => {
  const [start, end] = window.split('-');
  return {
    startsAt: new Date(`${dateStr}T${start}:00`).toISOString(),
    endsAt: new Date(`${dateStr}T${end}:00`).toISOString(),
  };
};

/** Extract a "HH:MM-HH:MM" window from a slot's ISO start/end timestamps. */
export const timeWindowFromSlot = (slot: AvailabilitySlot): string => {
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`;
};

/** Identify all scheduled/completed match dates from a match array (not unscheduled suggestions). */
export const getMatchDates = (matches: Match[]): DateString[] =>
  Array.from(
    new Set(
      matches
        .filter((m) => isBlockingStatus(m.status))
        .map((m) => normalizeDate(`${m.match_date}T12:00:00`))
    )
  );

export const isMatchDay = (dateStr: DateString, matchDates: DateString[]): boolean =>
  matchDates.includes(dateStr);

export const isAvailableAnytime = (
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>
): boolean => availabilityMap.get(dateStr)?.mode === 'anytime';

export const isBlockedAllDay = (
  dateStr: DateString,
  blockingMap: Map<DateString, DayBlock>
): boolean => blockingMap.get(dateStr)?.mode === 'all_day';

/** Build a date -> availability map (mode + time windows) from a player's "available" slots. */
export const buildAvailabilityMap = (
  slots: AvailabilitySlot[]
): Map<DateString, DayAvailability> => {
  const map = new Map<DateString, DayAvailability>();
  slots
    .filter((slot) => (slot.kind ?? 'available') === 'available')
    .forEach((slot) => {
      const date = normalizeDate(slot.startsAt);
      if ((slot.mode ?? 'time_windows') === 'anytime') {
        map.set(date, { date, mode: 'anytime' });
        return;
      }
      const existing = map.get(date);
      if (existing?.mode === 'anytime') return;
      const windows = existing?.timeWindows ? [...existing.timeWindows] : [];
      const window = timeWindowFromSlot(slot);
      if (!windows.includes(window)) windows.push(window);
      map.set(date, { date, mode: 'time_windows', timeWindows: windows });
    });
  return map;
};

/** Build a date -> block map (mode + time windows) from a player's "blocked" slots. */
export const buildBlockingMap = (slots: AvailabilitySlot[]): Map<DateString, DayBlock> => {
  const map = new Map<DateString, DayBlock>();
  slots
    .filter((slot) => (slot.kind ?? 'available') === 'blocked')
    .forEach((slot) => {
      const date = normalizeDate(slot.startsAt);
      if ((slot.mode ?? 'time_windows') === 'all_day') {
        map.set(date, { date, mode: 'all_day' });
        return;
      }
      const existing = map.get(date);
      if (existing?.mode === 'all_day') return;
      const windows = existing?.timeWindows ? [...existing.timeWindows] : [];
      const window = timeWindowFromSlot(slot);
      if (!windows.includes(window)) windows.push(window);
      map.set(date, { date, mode: 'time_windows', timeWindows: windows });
    });
  return map;
};

/** Determine the visual and interaction state of a date in the availability picker. */
export const getAvailabilityDateState = (
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>,
  blockingMap: Map<DateString, DayBlock>,
  matchDates: DateString[]
): { state: DateState; disabledReason: DisabledReason } => {
  if (isMatchDay(dateStr, matchDates)) return { state: 'match', disabledReason: 'match-day' };
  if (isBlockedAllDay(dateStr, blockingMap))
    return { state: 'blocked-all-day', disabledReason: 'blocked-all-day' };

  const available = availabilityMap.get(dateStr);
  if (available?.mode === 'anytime') return { state: 'available-anytime', disabledReason: 'none' };
  if (available) return { state: 'available', disabledReason: 'none' };
  return { state: 'normal', disabledReason: 'none' };
};

/** Determine the visual and interaction state of a date in the blocking picker. */
export const getBlockingDateState = (
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>,
  blockingMap: Map<DateString, DayBlock>,
  matchDates: DateString[]
): { state: DateState; disabledReason: DisabledReason } => {
  if (isMatchDay(dateStr, matchDates)) return { state: 'match', disabledReason: 'match-day' };
  if (isAvailableAnytime(dateStr, availabilityMap))
    return { state: 'available-anytime', disabledReason: 'available-anytime' };

  const blocked = blockingMap.get(dateStr);
  if (blocked?.mode === 'all_day') return { state: 'blocked-all-day', disabledReason: 'none' };
  if (blocked) return { state: 'blocked', disabledReason: 'none' };
  return { state: 'normal', disabledReason: 'none' };
};

/** Convenience wrapper used by both pickers to get date state. */
export const getDateState = (
  pickerType: PickerType,
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>,
  blockingMap: Map<DateString, DayBlock>,
  matchDates: DateString[]
) =>
  pickerType === 'availability'
    ? getAvailabilityDateState(dateStr, availabilityMap, blockingMap, matchDates)
    : getBlockingDateState(dateStr, availabilityMap, blockingMap, matchDates);

/** A date is disabled/unselectable in a given picker when it has a disabling reason. */
export const isDateDisabled = (state: DateState): boolean =>
  state === 'match' || state === 'blocked-all-day' || state === 'available-anytime';

export const getDisabledReason = (
  pickerType: PickerType,
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>,
  blockingMap: Map<DateString, DayBlock>,
  matchDates: DateString[]
): DisabledReason =>
  getDateState(pickerType, dateStr, availabilityMap, blockingMap, matchDates).disabledReason;

/** Human-readable reason why a date is disabled. */
export const getDisabledReasonLabel = (reason: DisabledReason): string => {
  switch (reason) {
    case 'blocked-all-day':
      return 'Blocked all day';
    case 'available-anytime':
      return 'Available anytime';
    case 'match-day':
      return 'Match day';
    case 'none':
    default:
      return '';
  }
};

/** Validate that availability and blocking do not directly conflict for a given date. */
export const validateAvailabilityBlockingConflict = (
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>,
  blockingMap: Map<DateString, DayBlock>
): { valid: boolean; error?: string } => {
  const availability = availabilityMap.get(dateStr);
  const blocking = blockingMap.get(dateStr);
  if (!availability || !blocking) return { valid: true };

  if (availability.mode === 'anytime' || blocking.mode === 'all_day') {
    return { valid: false, error: 'Cannot be both available and blocked on the same date.' };
  }

  if (availability.timeWindows && blocking.timeWindows) {
    for (const availWindow of availability.timeWindows) {
      for (const blockWindow of blocking.timeWindows) {
        if (doTimeWindowsOverlap(availWindow, blockWindow)) {
          return { valid: false, error: 'Availability and blocking time windows overlap.' };
        }
      }
    }
  }

  return { valid: true };
};

export const hasOverlappingWindows = (
  dateStr: DateString,
  availabilityMap: Map<DateString, DayAvailability>,
  blockingMap: Map<DateString, DayBlock>
): boolean => !validateAvailabilityBlockingConflict(dateStr, availabilityMap, blockingMap).valid;
