import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAvailabilityMap,
  buildBlockingMap,
  doTimeWindowsOverlap,
  getAvailabilityDateState,
  getBlockingDateState,
  getMatchDates,
  getPlayableTimeWindows,
  hasOverlappingWindows,
  isWeekend,
  validateAvailabilityBlockingConflict,
} from '../app/lib/availabilityHelpers.ts';

const slot = (overrides) => ({
  id: overrides.id ?? 'x',
  playerId: 'p',
  startsAt: overrides.startsAt,
  endsAt: overrides.endsAt,
  kind: overrides.kind,
  mode: overrides.mode,
});

test('weekday time windows exclude 9am-6pm and only offer morning/evening', () => {
  // 2026-09-14 is a Monday
  const options = getPlayableTimeWindows('2026-09-14');
  assert.equal(isWeekend('2026-09-14'), false);
  assert.deepEqual(
    options.map((o) => o.value),
    ['06:00-09:00', '18:00-22:00']
  );
  for (const option of options) {
    assert.equal(doTimeWindowsOverlap(option.value, '09:00-18:00'), false);
  }
});

test('weekend time windows offer morning/afternoon/evening across the full day', () => {
  // 2026-09-12 is a Saturday
  assert.equal(isWeekend('2026-09-12'), true);
  const options = getPlayableTimeWindows('2026-09-12');
  assert.deepEqual(
    options.map((o) => o.value),
    ['06:00-12:00', '12:00-18:00', '18:00-22:00']
  );
});

test('doTimeWindowsOverlap detects overlapping and non-overlapping ranges', () => {
  assert.equal(doTimeWindowsOverlap('06:00-09:00', '08:00-10:00'), true);
  assert.equal(doTimeWindowsOverlap('06:00-09:00', '09:00-12:00'), false);
  assert.equal(doTimeWindowsOverlap('06:00-09:00', '10:00-12:00'), false);
});

test('match days (scheduled/completed) are identified, unscheduled suggestions are not', () => {
  const matches = [
    {
      id: '1',
      matchup: '',
      match_date: '2026-09-12',
      match_time: '10:00',
      court: '',
      status: 'Scheduled',
    },
    {
      id: '2',
      matchup: '',
      match_date: '2026-09-13',
      match_time: '10:00',
      court: '',
      status: 'Completed',
    },
    {
      id: '3',
      matchup: '',
      match_date: '2026-09-14',
      match_time: '10:00',
      court: '',
      status: 'unscheduled',
    },
    {
      id: '4',
      matchup: '',
      match_date: '2026-09-15',
      match_time: '10:00',
      court: '',
      status: 'Cancelled',
    },
  ];
  const dates = getMatchDates(matches);
  assert.deepEqual(dates.sort(), ['2026-09-12', '2026-09-13']);
});

test('a fully blocked date is disabled and annotated in the availability picker', () => {
  const blockingSlots = [
    slot({
      id: 'b1',
      startsAt: '2026-09-12T00:00:00',
      endsAt: '2026-09-12T23:59:59',
      kind: 'blocked',
      mode: 'all_day',
    }),
  ];
  const blockingMap = buildBlockingMap(blockingSlots);
  const availabilityMap = buildAvailabilityMap([]);
  const { state, disabledReason } = getAvailabilityDateState(
    '2026-09-12',
    availabilityMap,
    blockingMap,
    []
  );
  assert.equal(state, 'blocked-all-day');
  assert.equal(disabledReason, 'blocked-all-day');
});

test('an available-anytime date is disabled and annotated in the blocking picker', () => {
  const availabilitySlots = [
    slot({
      id: 'a1',
      startsAt: '2026-09-12T00:00:00',
      endsAt: '2026-09-12T23:59:59',
      kind: 'available',
      mode: 'anytime',
    }),
  ];
  const availabilityMap = buildAvailabilityMap(availabilitySlots);
  const blockingMap = buildBlockingMap([]);
  const { state, disabledReason } = getBlockingDateState(
    '2026-09-12',
    availabilityMap,
    blockingMap,
    []
  );
  assert.equal(state, 'available-anytime');
  assert.equal(disabledReason, 'available-anytime');
});

test('match days are disabled in both pickers regardless of availability/blocking state', () => {
  const matchDates = ['2026-09-12'];
  const availabilityMap = buildAvailabilityMap([]);
  const blockingMap = buildBlockingMap([]);
  assert.equal(
    getAvailabilityDateState('2026-09-12', availabilityMap, blockingMap, matchDates).state,
    'match'
  );
  assert.equal(
    getBlockingDateState('2026-09-12', availabilityMap, blockingMap, matchDates).state,
    'match'
  );
});

test('overlapping availability/blocked time windows on the same date are flagged invalid', () => {
  const availabilityMap = buildAvailabilityMap([
    slot({
      id: 'a1',
      startsAt: '2026-09-12T06:00:00',
      endsAt: '2026-09-12T09:00:00',
      kind: 'available',
      mode: 'time_windows',
    }),
  ]);
  const blockingMap = buildBlockingMap([
    slot({
      id: 'b1',
      startsAt: '2026-09-12T08:00:00',
      endsAt: '2026-09-12T10:00:00',
      kind: 'blocked',
      mode: 'time_windows',
    }),
  ]);
  const result = validateAvailabilityBlockingConflict('2026-09-12', availabilityMap, blockingMap);
  assert.equal(result.valid, false);
  assert.equal(hasOverlappingWindows('2026-09-12', availabilityMap, blockingMap), true);
});

test('non-overlapping availability/blocked windows on the same date are allowed', () => {
  const availabilityMap = buildAvailabilityMap([
    slot({
      id: 'a1',
      startsAt: '2026-09-12T06:00:00',
      endsAt: '2026-09-12T09:00:00',
      kind: 'available',
      mode: 'time_windows',
    }),
  ]);
  const blockingMap = buildBlockingMap([
    slot({
      id: 'b1',
      startsAt: '2026-09-12T18:00:00',
      endsAt: '2026-09-12T22:00:00',
      kind: 'blocked',
      mode: 'time_windows',
    }),
  ]);
  const result = validateAvailabilityBlockingConflict('2026-09-12', availabilityMap, blockingMap);
  assert.equal(result.valid, true);
});
