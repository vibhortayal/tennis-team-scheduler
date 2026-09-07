import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Match } from '../app/lib/matches.ts';
import {
  getCompletedMatchesForTeam,
  getUpcomingMatchesForTeam,
  getTeamMatchHistory,
  isFinalizedMatchStatus,
  isUpcomingMatchStatus,
} from '../app/lib/teamMatchHistory.ts';

const baseMatch = (overrides: Partial<Match>): Match => ({
  id: overrides.id ?? 'id',
  matchup: overrides.matchup ?? 'Team #9 vs Team #11',
  match_date: overrides.match_date ?? '2026-08-01',
  match_time: overrides.match_time ?? '06:30:00',
  court: overrides.court ?? 'WS',
  status: overrides.status ?? 'Scheduled',
  result: overrides.result ?? null,
  league_group: overrides.league_group ?? 'Group A',
  excluded_from_standings: overrides.excluded_from_standings,
});

test('a selected team only sees matches it participates in', () => {
  const matches: Match[] = [
    baseMatch({ id: '1', matchup: 'Team #9 vs Team #11', status: 'Completed', result: '6-1, 6-4' }),
    baseMatch({ id: '2', matchup: 'Team #7 vs Team #12', status: 'Completed', result: '6-1, 6-4' }),
  ];
  const history = getTeamMatchHistory(matches, 'Group A', '9');
  assert.equal(history.completed.length, 1);
  assert.equal(history.completed[0].match.id, '1');
});

test('a selected team does not see matches from a different group', () => {
  const matches: Match[] = [
    baseMatch({
      id: '1',
      matchup: 'Team #9 vs Team #11',
      status: 'Completed',
      result: '6-1, 6-4',
      league_group: 'Group B',
    }),
  ];
  const history = getTeamMatchHistory(matches, 'Group A', '9');
  assert.equal(history.completed.length, 0);
});

test('completed matches are sorted newest first', () => {
  const matches: Match[] = [
    baseMatch({ id: 'old', match_date: '2026-07-01', status: 'Completed', result: '6-1, 6-4' }),
    baseMatch({ id: 'new', match_date: '2026-08-15', status: 'Completed', result: '6-1, 6-4' }),
    baseMatch({ id: 'mid', match_date: '2026-08-01', status: 'Completed', result: '6-1, 6-4' }),
  ];
  const completed = getCompletedMatchesForTeam(matches, 'Group A', '9');
  assert.deepEqual(completed.map((c) => c.match.id), ['new', 'mid', 'old']);
});

test('upcoming matches are sorted soonest first', () => {
  const matches: Match[] = [
    baseMatch({ id: 'far', match_date: '2026-09-20', status: 'Scheduled' }),
    baseMatch({ id: 'near', match_date: '2026-09-08', status: 'Scheduled' }),
  ];
  const upcoming = getUpcomingMatchesForTeam(matches, 'Group A', '9');
  assert.deepEqual(upcoming.map((u) => u.match.id), ['near', 'far']);
});

test('Completed, Retired, and Walkover statuses all classify as finalized', () => {
  assert.equal(isFinalizedMatchStatus('Completed'), true);
  assert.equal(isFinalizedMatchStatus('Retired'), true);
  assert.equal(isFinalizedMatchStatus('Walkover'), true);
  assert.equal(isFinalizedMatchStatus('Scheduled'), false);
  assert.equal(isFinalizedMatchStatus('Cancelled'), false);
  assert.equal(isFinalizedMatchStatus('voided'), false);
});

test('Retired and Walkover matches appear in completed history', () => {
  const matches: Match[] = [
    baseMatch({ id: 'r', status: 'Retired', result: '6-1, 3-0' }),
    baseMatch({ id: 'w', status: 'Walkover', result: '6-0, 6-0' }),
  ];
  const completed = getCompletedMatchesForTeam(matches, 'Group A', '9');
  assert.equal(completed.length, 2);
});

test('voided and cancelled matches never appear as upcoming', () => {
  assert.equal(isUpcomingMatchStatus('voided'), false);
  assert.equal(isUpcomingMatchStatus('Cancelled'), false);
  assert.equal(isUpcomingMatchStatus('Scheduled'), true);

  const matches: Match[] = [
    baseMatch({ id: 'v', status: 'voided' }),
    baseMatch({ id: 'c', status: 'Cancelled' }),
    baseMatch({ id: 's', status: 'Scheduled' }),
  ];
  const upcoming = getUpcomingMatchesForTeam(matches, 'Group A', '9');
  assert.deepEqual(upcoming.map((u) => u.match.id), ['s']);
});

test('a team with no matches at all returns empty completed and upcoming lists', () => {
  const history = getTeamMatchHistory([], 'Group A', '9');
  assert.deepEqual(history.completed, []);
  assert.deepEqual(history.upcoming, []);
});

test('a team with only completed matches has an empty upcoming list', () => {
  const matches: Match[] = [
    baseMatch({ id: 'c1', status: 'Completed', result: '6-1, 6-4' }),
  ];
  const history = getTeamMatchHistory(matches, 'Group A', '9');
  assert.equal(history.completed.length, 1);
  assert.deepEqual(history.upcoming, []);
});

test('a team with only upcoming matches has an empty completed list', () => {
  const matches: Match[] = [baseMatch({ id: 'u1', status: 'Scheduled' })];
  const history = getTeamMatchHistory(matches, 'Group A', '9');
  assert.deepEqual(history.completed, []);
  assert.equal(history.upcoming.length, 1);
});

test('outcome reflects Win/Loss from the selected team perspective', () => {
  const matches: Match[] = [
    baseMatch({
      id: 'win-for-9',
      matchup: 'Team #9 vs Team #11',
      status: 'Completed',
      result: '6-1, 6-4',
    }),
  ];
  const completedFor9 = getCompletedMatchesForTeam(matches, 'Group A', '9');
  const completedFor11 = getCompletedMatchesForTeam(matches, 'Group A', '11');
  assert.equal(completedFor9[0].outcome, 'Win');
  assert.equal(completedFor11[0].outcome, 'Loss');
});

test('excluded_from_standings matches remain visible in completed history but are flagged', () => {
  const matches: Match[] = [
    baseMatch({
      id: 'excluded',
      status: 'Completed',
      result: '6-1, 6-4',
      excluded_from_standings: true,
    }),
  ];
  const completed = getCompletedMatchesForTeam(matches, 'Group A', '9');
  assert.equal(completed.length, 1);
  assert.equal(completed[0].isExcludedFromStandings, true);
});
