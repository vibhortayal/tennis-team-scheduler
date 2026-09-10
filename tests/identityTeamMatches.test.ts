import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesForIdentityTeam } from '../app/lib/matches.ts';
import type { Match } from '../app/lib/matches.ts';
import type { Group, Identity } from '../app/teams.ts';

const match = (id: string, matchup: string, group?: Group): Match => ({
  id,
  matchup,
  match_date: '2026-09-10',
  match_time: '18:00',
  court: 'Court 1',
  status: 'Scheduled',
  league_group: group,
});

const identity: Identity = { name: 'Vibhor', teamId: '2', group: 'Group A' };

test('returns matches in the identity group involving the identity team', () => {
  const matches = [
    match('a', 'Team #1 vs Team #2', 'Group A'),
    match('b', 'Team #3 vs Team #4', 'Group A'),
    match('c', 'Team #2 vs Team #5', 'Group A'),
  ];
  assert.deepEqual(
    matchesForIdentityTeam(matches, identity).map((m) => m.id),
    ['a', 'c']
  );
});

test('excludes other-group matches even when the team id appears', () => {
  const matches = [match('a', 'Team #1 vs Team #2', 'Group B')];
  assert.deepEqual(matchesForIdentityTeam(matches, identity), []);
});

test('returns an empty list when the identity has no team', () => {
  const viewing: Identity = { name: 'Viewer', teamId: '', group: 'Group A', viewing: true };
  const matches = [match('a', 'Team #1 vs Team #2', 'Group A')];
  assert.deepEqual(matchesForIdentityTeam(matches, viewing), []);
});
