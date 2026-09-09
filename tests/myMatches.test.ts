import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  myMatches,
  overdueMatchesForTeam,
  recentCompletedMatchesForTeam,
  upcomingMatchesForTeam,
} from '../app/lib/myMatches.ts';
import type { Match } from '../app/lib/matches.ts';

// Fixed "now" in Fremont-time format (YYYY-MM-DDTHH:MM) for deterministic tests.
const NOW = '2026-09-09T14:00';

const base = (over: Partial<Match>): Match => ({
  id: 'x',
  matchup: 'Team #10 vs Team #3',
  match_date: '2026-09-01',
  match_time: '10:00',
  court: 'Court 2',
  status: 'Scheduled',
  league_group: 'Group B',
  ...over,
});

const ids = (matches: Match[]) => matches.map((m) => m.id);

// ---------------------------------------------------------------------------
// overdueMatchesForTeam
// ---------------------------------------------------------------------------

test('overdue includes only the identity team\u2019s past scheduled matches, oldest first', () => {
  const all = [
    base({ id: 'own-past', match_date: '2026-09-01' }),
    base({ id: 'other-past', matchup: 'Team #4 vs Team #6', match_date: '2026-09-01' }),
    base({ id: 'own-past-2', matchup: 'Team #13 vs Team #10', match_date: '2026-08-20' }),
  ];

  assert.deepEqual(ids(overdueMatchesForTeam(all, 'Group B', '10', NOW)), [
    'own-past-2',
    'own-past',
  ]);
});

test('overdue excludes non-Scheduled and future-dated matches', () => {
  const all = [
    base({ id: 'completed-past', status: 'Completed', result: '6-4, 6-4' }),
    base({ id: 'retired-past', status: 'Retired' }),
    base({ id: 'cancelled-past', status: 'Cancelled' }),
    base({ id: 'future', match_date: '2026-09-10' }),
    base({ id: 'later-today', match_date: '2026-09-09', match_time: '15:00' }),
    base({ id: 'earlier-today', match_date: '2026-09-09', match_time: '13:00' }),
  ];

  assert.deepEqual(ids(overdueMatchesForTeam(all, 'Group B', '10', NOW)), ['earlier-today']);
});

test('team id matching is exact: Team #1 does not match Team #10', () => {
  const all = [base({ id: 'ten', matchup: 'Team #10 vs Team #3' })];

  assert.deepEqual(overdueMatchesForTeam(all, 'Group B', '1', NOW), []);
  assert.deepEqual(ids(overdueMatchesForTeam(all, 'Group B', '10', NOW)), ['ten']);
});

// ---------------------------------------------------------------------------
// upcomingMatchesForTeam
// ---------------------------------------------------------------------------

test('upcoming returns only future Scheduled matches for the team, soonest first', () => {
  const all = [
    base({ id: 'u1', match_date: '2026-09-12' }),
    base({ id: 'u2', match_date: '2026-09-10', match_time: '09:00' }),
    base({ id: 'u3', match_date: '2026-09-20' }),
    base({ id: 'u4', match_date: '2026-09-09', match_time: '15:00' }),
    base({ id: 'past', match_date: '2026-09-01' }),
    base({ id: 'done', status: 'Completed', match_date: '2026-09-12' }),
    base({ id: 'other', matchup: 'Team #4 vs Team #6', match_date: '2026-09-11' }),
  ];

  assert.deepEqual(ids(upcomingMatchesForTeam(all, 'Group B', '10', NOW)), [
    'u4',
    'u2',
    'u1',
    'u3',
  ]);
});

// ---------------------------------------------------------------------------
// recentCompletedMatchesForTeam
// ---------------------------------------------------------------------------

test('recent returns only finalized matches for the team, most-recent first', () => {
  const all = [
    base({ id: 'r1', status: 'Completed', match_date: '2026-08-20', result: '6-4, 6-4' }),
    base({ id: 'r2', status: 'Retired', match_date: '2026-08-25' }),
    base({ id: 'r3', status: 'Walkover', match_date: '2026-08-22' }),
    base({ id: 'scheduled', match_date: '2026-08-10' }),
    base({ id: 'cancelled', status: 'Cancelled', match_date: '2026-08-24' }),
    base({
      id: 'other',
      matchup: 'Team #4 vs Team #6',
      status: 'Completed',
      match_date: '2026-08-26',
    }),
  ];

  assert.deepEqual(ids(recentCompletedMatchesForTeam(all, 'Group B', '10')), ['r2', 'r3', 'r1']);
});

// ---------------------------------------------------------------------------
// Empty selections
// ---------------------------------------------------------------------------

test('a team with no matches returns empty arrays for each selector independently', () => {
  const all = [base({ id: 'm1' })];

  assert.deepEqual(overdueMatchesForTeam(all, 'Group B', '99', NOW), []);
  assert.deepEqual(upcomingMatchesForTeam(all, 'Group B', '99', NOW), []);
  assert.deepEqual(recentCompletedMatchesForTeam(all, 'Group B', '99'), []);
  assert.deepEqual(myMatches(all, 'Group B', '99', NOW), {
    overdue: [],
    upcoming: [],
    recent: [],
  });
});

test('a team with only upcoming matches has empty overdue and recent selections', () => {
  const all = [base({ id: 'only-upcoming', match_date: '2026-09-15' })];
  const result = myMatches(all, 'Group B', '10', NOW);

  assert.deepEqual(ids(result.upcoming), ['only-upcoming']);
  assert.deepEqual(result.overdue, []);
  assert.deepEqual(result.recent, []);
});

test('an empty team id selects nothing', () => {
  const all = [base({ id: 'm1' })];

  assert.deepEqual(myMatches(all, 'Group B', '', NOW), { overdue: [], upcoming: [], recent: [] });
});

// ---------------------------------------------------------------------------
// Group scoping
// ---------------------------------------------------------------------------

test('selection is scoped by group: same team id in another group does not leak in', () => {
  const crossGroup = base({
    id: 'cross',
    matchup: 'Team #10 vs Team #2',
    league_group: 'Group A',
    match_date: '2026-09-01',
  });
  const crossGroupRecent = base({
    id: 'cross-recent',
    matchup: 'Team #10 vs Team #2',
    league_group: 'Group A',
    status: 'Completed',
    match_date: '2026-08-15',
  });
  const all = [crossGroup, crossGroupRecent];

  // Group B query must not pick up the Group A fixtures.
  assert.deepEqual(myMatches(all, 'Group B', '10', NOW), {
    overdue: [],
    upcoming: [],
    recent: [],
  });

  // The same fixtures are visible when scoped to their own group.
  const inGroupA = myMatches(all, 'Group A', '10', NOW);
  assert.deepEqual(ids(inGroupA.overdue), ['cross']);
  assert.deepEqual(ids(inGroupA.recent), ['cross-recent']);
});

// ---------------------------------------------------------------------------
// myMatches aggregate
// ---------------------------------------------------------------------------

test('myMatches returns the structured overdue/upcoming/recent selection', () => {
  const all = [
    base({ id: 'overdue', match_date: '2026-09-01' }),
    base({ id: 'upcoming', match_date: '2026-09-15' }),
    base({ id: 'recent', status: 'Completed', match_date: '2026-08-20' }),
    base({ id: 'other-team', matchup: 'Team #4 vs Team #6', match_date: '2026-09-01' }),
  ];

  const result = myMatches(all, 'Group B', '10', NOW);

  assert.deepEqual(ids(result.overdue), ['overdue']);
  assert.deepEqual(ids(result.upcoming), ['upcoming']);
  assert.deepEqual(ids(result.recent), ['recent']);
});
