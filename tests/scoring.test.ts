import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, parseResultString } from '../app/lib/scoring.ts';
import type { Match } from '../app/lib/matches.ts';

test('parseResultString handles the "Team #X def. Team #Y, A-B, C-D" prefix format', () => {
  const parsed = parseResultString('Team #9 def. Team #11, 6-1, 6-4');
  assert.deepEqual(parsed, {
    set1: { teamA: 6, teamB: 1 },
    set2: { teamA: 6, teamB: 4 },
    set3: undefined,
  });
});

test('parseResultString still parses plain "6-3, 6-4" results', () => {
  const parsed = parseResultString('6-3, 6-4');
  assert.deepEqual(parsed, {
    set1: { teamA: 6, teamB: 3 },
    set2: { teamA: 6, teamB: 4 },
    set3: undefined,
  });
});

test('a completed match with a "Team #X def. Team #Y" result is counted in Group A standings', () => {
  const matches: Match[] = [
    {
      id: '1',
      matchup: 'Team #9 vs Team #11',
      match_date: '2026-08-30',
      match_time: '06:30:00',
      court: 'WS',
      status: 'Completed',
      result: 'Team #9 def. Team #11, 6-1, 6-4',
      league_group: 'Group A',
    },
  ];
  const standings = computeStandings(matches, 'Group A');
  const winner = standings.find((row) => row.teamId === '9');
  const loser = standings.find((row) => row.teamId === '11');
  assert.ok(winner);
  assert.ok(loser);
  assert.equal(winner!.matchesWon, 1);
  assert.equal(winner!.matchesPlayed, 1);
  assert.equal(winner!.totalPoints, 2);
  assert.equal(loser!.matchesLost, 1);
  assert.equal(loser!.matchesPlayed, 1);
});
