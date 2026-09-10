import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuredDayMatches } from '../app/lib/matches.ts';
import type { Match } from '../app/lib/matches.ts';

const match = (id: string, date: string, time: string, status = 'Scheduled'): Match => ({
  id,
  matchup: '1 vs 2',
  match_date: date,
  match_time: time,
  court: 'Court 1',
  status,
});

test('returns every scheduled match on today when several are scheduled today', () => {
  const matches = [
    match('a', '2026-09-09', '18:00'),
    match('b', '2026-09-10', '18:00'),
    match('c', '2026-09-09', '09:00'),
  ];
  assert.deepEqual(
    featuredDayMatches(matches, '2026-09-09').map((m) => m.id),
    ['c', 'a']
  );
});

test('returns every match on the next scheduled date when none are today', () => {
  const matches = [
    match('a', '2026-09-12', '18:00'),
    match('b', '2026-09-10', '18:00'),
    match('c', '2026-09-10', '09:00'),
  ];
  assert.deepEqual(
    featuredDayMatches(matches, '2026-09-09').map((m) => m.id),
    ['c', 'b']
  );
});

test('ignores non-scheduled matches and matches before today', () => {
  const matches = [
    match('past', '2026-09-08', '18:00'),
    match('done', '2026-09-09', '09:00', 'Completed'),
    match('today', '2026-09-09', '18:00'),
  ];
  assert.deepEqual(
    featuredDayMatches(matches, '2026-09-09').map((m) => m.id),
    ['today']
  );
});

test('returns an empty list when no scheduled matches remain', () => {
  assert.deepEqual(featuredDayMatches([], '2026-09-09'), []);
  assert.deepEqual(featuredDayMatches([match('past', '2026-09-08', '18:00')], '2026-09-09'), []);
});
