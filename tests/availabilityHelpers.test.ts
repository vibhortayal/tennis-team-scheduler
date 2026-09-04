import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAvailabilityMap,
  buildBlockingMap,
  doTimeWindowsOverlap,
  getAvailabilityDateState,
  getBlockingDateState,
  getMatchDates,
  normalizeDate,
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

test('normalizeDate keeps the local day when reading ISO timestamps from saved evening slots', () => {
  const localEvening = new Date(2026, 8, 12, 18, 0, 0);
  assert.equal(normalizeDate(localEvening.toISOString()), normalizeDate(localEvening));
});

// ─── Feature 1: availability eligibility in match search ─────────────────────

import { isTeamEligibleForDate } from '../app/lib/availabilityHelpers.ts';

const makeSlot = (playerId: string, date: string, kind: 'available' | 'blocked' = 'available') => ({
  id: `${playerId}-${date}-${kind}`,
  playerId,
  startsAt: `${date}T06:00:00`,
  endsAt: `${date}T09:00:00`,
  kind,
});

test('team with both players available is eligible', () => {
  const slotsByPlayer = new Map([
    ['p1', [makeSlot('p1', '2026-09-12', 'available')]],
    ['p2', [makeSlot('p2', '2026-09-12', 'available')]],
  ]);
  assert.equal(isTeamEligibleForDate(['p1', 'p2'], slotsByPlayer, '2026-09-12'), true);
});

test('team with one player available and one with no record is eligible', () => {
  const slotsByPlayer = new Map([
    ['p1', [makeSlot('p1', '2026-09-12', 'available')]],
    // p2 has no record at all
  ]);
  assert.equal(isTeamEligibleForDate(['p1', 'p2'], slotsByPlayer, '2026-09-12'), true);
});

test('team with neither player having a record is eligible', () => {
  const slotsByPlayer = new Map<string, ReturnType<typeof makeSlot>[]>();
  assert.equal(isTeamEligibleForDate(['p1', 'p2'], slotsByPlayer, '2026-09-12'), true);
});

test('team with one player explicitly blocked is NOT eligible', () => {
  const slotsByPlayer = new Map([
    ['p1', [makeSlot('p1', '2026-09-12', 'available')]],
    ['p2', [makeSlot('p2', '2026-09-12', 'blocked')]],
  ]);
  assert.equal(isTeamEligibleForDate(['p1', 'p2'], slotsByPlayer, '2026-09-12'), false);
});

test('team with both players blocked is NOT eligible', () => {
  const slotsByPlayer = new Map([
    ['p1', [makeSlot('p1', '2026-09-12', 'blocked')]],
    ['p2', [makeSlot('p2', '2026-09-12', 'blocked')]],
  ]);
  assert.equal(isTeamEligibleForDate(['p1', 'p2'], slotsByPlayer, '2026-09-12'), false);
});

test('block on a different date does not affect eligibility for the searched date', () => {
  // p2 is blocked on Sep 13, not Sep 12 — should still be eligible for Sep 12
  const slotsByPlayer = new Map([
    ['p1', [makeSlot('p1', '2026-09-12', 'available')]],
    ['p2', [makeSlot('p2', '2026-09-13', 'blocked')]],
  ]);
  assert.equal(isTeamEligibleForDate(['p1', 'p2'], slotsByPlayer, '2026-09-12'), true);
});

// ─── Feature 2: date-detail player-status derivation ─────────────────────────
// The React component derives player status from raw slots; test the same logic
// as a pure function to validate the three-state classification.

type PlayerStatus = 'available' | 'blocked' | 'no-response';

const derivePlayerStatus = (
  playerKey: string,
  date: string,
  allSlots: { playerId: string; startsAt: string; kind?: string }[]
): PlayerStatus => {
  const slots = allSlots.filter(
    (s) => s.playerId === playerKey && normalizeDate(s.startsAt) === date
  );
  const hasAvailable = slots.some((s) => (s.kind ?? 'available') === 'available');
  const hasBlocked = slots.some((s) => (s.kind ?? 'available') === 'blocked');
  return hasBlocked ? 'blocked' : hasAvailable ? 'available' : 'no-response';
};

test('player with an available slot shows Available', () => {
  const allSlots = [{ playerId: 'p1', startsAt: '2026-09-12T06:00:00', kind: 'available' }];
  assert.equal(derivePlayerStatus('p1', '2026-09-12', allSlots), 'available');
});

test('player with a blocked slot shows Blocked', () => {
  const allSlots = [{ playerId: 'p1', startsAt: '2026-09-12T06:00:00', kind: 'blocked' }];
  assert.equal(derivePlayerStatus('p1', '2026-09-12', allSlots), 'blocked');
});

test('player with no record shows No response, not Blocked', () => {
  const allSlots: { playerId: string; startsAt: string; kind?: string }[] = [];
  assert.equal(derivePlayerStatus('p1', '2026-09-12', allSlots), 'no-response');
});

test('when a player has both available and blocked slots, blocked takes precedence', () => {
  const allSlots = [
    { playerId: 'p1', startsAt: '2026-09-12T06:00:00', kind: 'available' },
    { playerId: 'p1', startsAt: '2026-09-12T18:00:00', kind: 'blocked' },
  ];
  assert.equal(derivePlayerStatus('p1', '2026-09-12', allSlots), 'blocked');
});

test('player status from a different date does not affect the queried date', () => {
  // Only a record on Sep 13 — querying Sep 12 should give no-response
  const allSlots = [{ playerId: 'p1', startsAt: '2026-09-13T06:00:00', kind: 'available' }];
  assert.equal(derivePlayerStatus('p1', '2026-09-12', allSlots), 'no-response');
});

test('details can be grouped by team using teamAvailabilityContext shape', () => {
  // Simulate the component's grouping logic for two teams
  const teamCtx = [
    {
      teamId: '2',
      displayName: 'Team #2 — Alice / Bob',
      players: [
        { key: 'GA:2:Alice', name: 'Alice' },
        { key: 'GA:2:Bob', name: 'Bob' },
      ],
    },
    {
      teamId: '5',
      displayName: 'Team #5 — Carol / Dave',
      players: [
        { key: 'GA:5:Carol', name: 'Carol' },
        { key: 'GA:5:Dave', name: 'Dave' },
      ],
    },
  ];
  const allSlots = [
    { playerId: 'GA:2:Alice', startsAt: '2026-09-12T06:00:00', kind: 'available' },
    // Bob has no record
    { playerId: 'GA:5:Carol', startsAt: '2026-09-12T06:00:00', kind: 'blocked' },
    { playerId: 'GA:5:Dave', startsAt: '2026-09-12T06:00:00', kind: 'available' },
  ];
  const date = '2026-09-12';

  const details = teamCtx.map((team) => ({
    displayName: team.displayName,
    players: team.players.map((p) => ({
      name: p.name,
      status: derivePlayerStatus(p.key, date, allSlots),
    })),
  }));

  assert.equal(details.length, 2);
  assert.equal(details[0].displayName, 'Team #2 — Alice / Bob');
  assert.equal(details[0].players[0].status, 'available'); // Alice available
  assert.equal(details[0].players[1].status, 'no-response'); // Bob has no record
  assert.equal(details[1].players[0].status, 'blocked'); // Carol blocked
  assert.equal(details[1].players[1].status, 'available'); // Dave available
});
