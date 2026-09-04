import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, parseResultString } from '../app/lib/scoring.ts';
import { pendingOpponentsForTeam } from '../app/lib/matches.ts';
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

test('pending opponents exclude completed and scheduled matches but ignore cancelled matches', () => {
  const matches: Match[] = [
    {
      id: '1',
      matchup: 'Team #10 vs Team #1',
      match_date: '2026-08-30',
      match_time: '06:30:00',
      court: 'WS',
      status: 'Completed',
      result: '6-1, 6-4',
      league_group: 'Group B',
    },
    {
      id: '2',
      matchup: 'Team #10 vs Team #3',
      match_date: '2026-09-10',
      match_time: '06:30:00',
      court: 'WS',
      status: 'Scheduled',
      league_group: 'Group B',
    },
    {
      id: '3',
      matchup: 'Team #10 vs Team #4',
      match_date: '2026-09-11',
      match_time: '06:30:00',
      court: 'WS',
      status: 'Cancelled',
      league_group: 'Group B',
    },
  ];

  assert.deepEqual(pendingOpponentsForTeam(matches, 'Group B', '10'), ['4', '6', '8', '13']);
});

test('voided/excluded matches do not affect standings', () => {
  const matches: Match[] = [
    {
      id: '1',
      matchup: 'Team #9 vs Team #11',
      match_date: '2026-08-30',
      match_time: '06:30:00',
      court: 'WS',
      status: 'Completed',
      result: '6-1, 6-4',
      league_group: 'Group A',
      excluded_from_standings: true,
    },
    {
      id: '2',
      matchup: 'Team #9 vs Team #12',
      match_date: '2026-08-31',
      match_time: '06:30:00',
      court: 'WS',
      status: 'voided',
      result: '6-1, 6-4',
      league_group: 'Group A',
    },
  ];
  const standings = computeStandings(matches, 'Group A');
  const t9 = standings.find((r) => r.teamId === '9')!;
  assert.equal(t9.matchesPlayed, 0);
  assert.equal(t9.matchesWon, 0);
  assert.equal(t9.totalPoints, 0);
});

test('withdrawal walkover override produces exactly 6-0, 6-0 for the opponent and preserves original', () => {
  const matches: Match[] = [
    {
      id: '1',
      matchup: 'Team #9 vs Team #11',
      match_date: '2026-08-30',
      match_time: '06:30:00',
      court: 'WS',
      status: 'Completed',
      result: '7-6, 7-6', // Team 9 originally won closely
      league_group: 'Group A',
      standings_override: {
        reason: 'team_withdrawal',
        winnerTeamId: '11',
        loserTeamId: '9',
        score: {
          set1: { teamA: 6, teamB: 0 },
          set2: { teamA: 6, teamB: 0 },
        },
      },
    },
  ];

  const standings = computeStandings(matches, 'Group A');

  // Team 11 should have won 6-0, 6-0 via override
  const t11 = standings.find((r) => r.teamId === '11')!;
  assert.equal(t11.matchesPlayed, 1);
  assert.equal(t11.matchesWon, 1);
  assert.equal(t11.gamesWon, 12);
  assert.equal(t11.gamesLost, 0);

  // Original Match object should not be mutated
  assert.equal(matches[0].result, '7-6, 7-6');
});
