import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNewTeam, getActiveRoster, getAllRoster } from '../app/lib/teamValidation.ts';
import {
  initialStaticTeams,
  TeamRecord,
  getActivePlayers,
  teamDisplay,
  teamNames,
  updateTeamRegistry,
} from '../app/teams.ts';
import { pendingOpponentsForTeam, teamIds } from '../app/lib/matches.ts';
import { computeStandings } from '../app/lib/scoring.ts';
import type { Match } from '../app/lib/matches.ts';

test('1. Valid team creation: trims whitespace and returns active status', () => {
  const result = validateNewTeam(
    {
      teamNumber: ' 14 ',
      player1: ' Roger Federer ',
      player2: ' Rafael Nadal ',
      group: 'Group A',
    },
    initialStaticTeams
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.teamNumber, '14');
    assert.equal(result.data.player1, 'Roger Federer');
    assert.equal(result.data.player2, 'Rafael Nadal');
    assert.equal(result.data.playerNames, 'Roger Federer, Rafael Nadal');
    assert.equal(result.data.group, 'Group A');
    assert.equal(result.data.status, 'active');
  }
});

test('2. Missing team number: rejected with validation error', () => {
  const emptyResult = validateNewTeam(
    {
      teamNumber: '',
      player1: 'Roger Federer',
      player2: 'Rafael Nadal',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(emptyResult.ok, false);
  if (!emptyResult.ok) {
    assert.equal(emptyResult.field, 'teamNumber');
    assert.match(emptyResult.error, /Team number is required/i);
  }

  const whitespaceResult = validateNewTeam(
    {
      teamNumber: '   ',
      player1: 'Roger Federer',
      player2: 'Rafael Nadal',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(whitespaceResult.ok, false);
  if (!whitespaceResult.ok) {
    assert.equal(whitespaceResult.field, 'teamNumber');
  }
});

test('3. Duplicate team number: rejected across the entire league', () => {
  // Team #2 exists in Group A
  const dupGroupA = validateNewTeam(
    {
      teamNumber: '2',
      player1: 'New Player 1',
      player2: 'New Player 2',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(dupGroupA.ok, false);
  if (!dupGroupA.ok) {
    assert.match(dupGroupA.error, /already exists in the league/i);
  }

  // Team #1 exists in Group B; attempting to add #1 to Group A must be rejected
  const dupAcrossGroup = validateNewTeam(
    {
      teamNumber: '1',
      player1: 'New Player 1',
      player2: 'New Player 2',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(dupAcrossGroup.ok, false);
  if (!dupAcrossGroup.ok) {
    assert.match(dupAcrossGroup.error, /already exists in the league/i);
  }
});

test('4. Missing player name: rejects empty or whitespace-only names', () => {
  const missingP1 = validateNewTeam(
    {
      teamNumber: '14',
      player1: '  ',
      player2: 'Rafael Nadal',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(missingP1.ok, false);
  if (!missingP1.ok) {
    assert.equal(missingP1.field, 'player1');
    assert.match(missingP1.error, /Player 1 name is required/i);
  }

  const missingP2 = validateNewTeam(
    {
      teamNumber: '14',
      player1: 'Roger Federer',
      player2: '',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(missingP2.ok, false);
  if (!missingP2.ok) {
    assert.equal(missingP2.field, 'player2');
    assert.match(missingP2.error, /Player 2 name is required/i);
  }
});

test('5. Same player entered twice: rejected with case and whitespace variations', () => {
  const exactSame = validateNewTeam(
    {
      teamNumber: '14',
      player1: 'Novak Djokovic',
      player2: 'Novak Djokovic',
      group: 'Group B',
    },
    initialStaticTeams
  );
  assert.equal(exactSame.ok, false);
  if (!exactSame.ok) {
    assert.match(exactSame.error, /cannot be the same person/i);
  }

  const caseAndWhitespaceSame = validateNewTeam(
    {
      teamNumber: '14',
      player1: '  Novak Djokovic  ',
      player2: 'novak djokovic',
      group: 'Group B',
    },
    initialStaticTeams
  );
  assert.equal(caseAndWhitespaceSame.ok, false);
  if (!caseAndWhitespaceSame.ok) {
    assert.match(caseAndWhitespaceSame.error, /cannot be the same person/i);
  }
});

test('6. Duplicate player pair in the same group: rejected regardless of player order and case', () => {
  // Existing Team #2 in Group A has: 'Sudharssun, Kaushik'
  const reversedPair = validateNewTeam(
    {
      teamNumber: '14',
      player1: 'Kaushik',
      player2: 'Sudharssun',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(reversedPair.ok, false);
  if (!reversedPair.ok) {
    assert.match(reversedPair.error, /already exists in Group A/i);
  }

  // Case differences with reversed order
  const caseReversedPair = validateNewTeam(
    {
      teamNumber: '15',
      player1: '  KAUSHIK ',
      player2: 'sudharssun',
      group: 'Group A',
    },
    initialStaticTeams
  );
  assert.equal(caseReversedPair.ok, false);
  if (!caseReversedPair.ok) {
    assert.match(caseReversedPair.error, /already exists in Group A/i);
  }

  // Same pair in a DIFFERENT group is allowed
  const diffGroupAllowed = validateNewTeam(
    {
      teamNumber: '16',
      player1: 'Kaushik',
      player2: 'Sudharssun',
      group: 'Group B',
    },
    initialStaticTeams
  );
  assert.equal(diffGroupAllowed.ok, true);
});

test('7. Newly added active team is included in active roster and used by scheduling', () => {
  const newTeam: TeamRecord = {
    teamId: '14',
    player1: 'Carlos Alcaraz',
    player2: 'Jannik Sinner',
    playerNames: 'Carlos Alcaraz, Jannik Sinner',
    group: 'Group A',
    status: 'active',
  };

  const updatedTeams = [...initialStaticTeams, newTeam];
  const activeRosterA = getActiveRoster(updatedTeams, 'Group A');

  // Verify newly added team is in active roster
  const found = activeRosterA.find(([id]) => id === '14');
  assert.ok(found, 'Team 14 should be present in Group A active roster');
  assert.equal(found![1], 'Carlos Alcaraz, Jannik Sinner');

  // Verify players list includes both new players
  const activePlayers = getActivePlayers(updatedTeams);
  const alcaraz = activePlayers.find((p) => p.name === 'Carlos Alcaraz');
  const sinner = activePlayers.find((p) => p.name === 'Jannik Sinner');
  assert.ok(alcaraz && alcaraz.teamId === '14' && alcaraz.group === 'Group A');
  assert.ok(sinner && sinner.teamId === '14' && sinner.group === 'Group A');

  // Verify pending opponents for Team #2 now includes new Team #14
  const pendingForTeam2 = pendingOpponentsForTeam([], 'Group A', '2', activeRosterA);
  assert.ok(
    pendingForTeam2.includes('14'),
    'Team 14 must be included in pending opponents for scheduling'
  );

  // Verify standings calculate dynamic total matches: (7 teams - 1 = 6 matches)
  const standings = computeStandings([], 'Group A', activeRosterA);
  assert.equal(standings.length, 7);
  assert.equal(standings[0].totalMatches, 6);
  assert.equal(standings[0].matchesRemaining, 6);
});

test('8. Withdrawn teams are excluded from future scheduling while remaining available for historical match display', () => {
  const withdrawnTeam: TeamRecord = {
    teamId: '99',
    player1: 'Bjorn Borg',
    player2: 'John McEnroe',
    playerNames: 'Bjorn Borg, John McEnroe',
    group: 'Group A',
    status: 'withdrawn',
  };

  const teamsWithWithdrawn = [...initialStaticTeams, withdrawnTeam];
  updateTeamRegistry(teamsWithWithdrawn);

  const activeRosterA = getActiveRoster(teamsWithWithdrawn, 'Group A');
  const allRosterA = getAllRoster(teamsWithWithdrawn, 'Group A');

  // Excluded from active roster
  assert.equal(
    activeRosterA.some(([id]) => id === '99'),
    false,
    'Withdrawn team must not be in active roster'
  );

  // Included in all roster (historical)
  assert.equal(
    allRosterA.some(([id]) => id === '99'),
    true,
    'Withdrawn team must be in all roster'
  );

  // Excluded from future scheduling proposals
  const pendingForTeam2 = pendingOpponentsForTeam([], 'Group A', '2', activeRosterA);
  assert.equal(
    pendingForTeam2.includes('99'),
    false,
    'Withdrawn team must not be suggested for future matches'
  );

  // Historical display still works via teamDisplay and teamNames
  const display = teamDisplay('Group A', '99');
  assert.equal(display, '#99 · Bjorn Borg & John McEnroe');

  const names = teamNames('Group A', '99');
  assert.equal(names, 'Bjorn Borg & John McEnroe');

  // Historical match with withdrawn team preserves teamIds recognition
  const historicalMatch: Match = {
    id: 'hist-1',
    matchup: 'Team #99 vs Team #2',
    match_date: '2026-08-01',
    match_time: '10:00',
    court: 'Court 1',
    status: 'Completed',
    result: '6-4, 6-4',
    league_group: 'Group A',
  };

  const ids = teamIds(historicalMatch, 'Group A');
  assert.deepEqual(ids, ['99', '2']);
});
