import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kheloMatchCounts,
  kheloRosterForGroup,
  mapKheloMatch,
  KHELO_TOURNAMENT_ID,
} from '../app/lib/kheloStandings.ts';

test('KHELO_TOURNAMENT_ID is the Innovation Tennis 2026 tournament', () => {
  assert.equal(KHELO_TOURNAMENT_ID, 'c11aa58d-acad-47be-bf2c-bf65d8630375');
});

test('kheloMatchCounts: completed + confirmed counts', () => {
  assert.equal(kheloMatchCounts({ status: 'Completed', verification_status: 'confirmed' }), true);
});

test('kheloMatchCounts: completed + unverified/null counts (legacy organizer-entered)', () => {
  assert.equal(kheloMatchCounts({ status: 'Completed', verification_status: 'unverified' }), true);
  assert.equal(kheloMatchCounts({ status: 'Completed', verification_status: null }), true);
  assert.equal(kheloMatchCounts({ status: 'Completed' }), true);
});

test('kheloMatchCounts: pending and disputed never count', () => {
  assert.equal(kheloMatchCounts({ status: 'Completed', verification_status: 'disputed' }), false);
  assert.equal(kheloMatchCounts({ status: 'Completed', verification_status: 'pending' }), false);
  assert.equal(kheloMatchCounts({ status: 'Pending', verification_status: 'confirmed' }), false);
  assert.equal(kheloMatchCounts({ status: 'Scheduled', verification_status: null }), false);
  assert.equal(kheloMatchCounts({}), false);
});

test('kheloMatchCounts: status match is case-insensitive and trimmed', () => {
  assert.equal(kheloMatchCounts({ status: ' completed ', verification_status: 'CONFIRMED' }), true);
});

test('kheloRosterForGroup: filters to the group and excludes withdrawn teams', () => {
  const rows = [
    { team_number: '3', player_names: 'A / B', group_name: 'Group A', status: 'active' },
    { team_number: '1', player_names: 'C / D', group_name: 'Group A', status: 'withdrawn' },
    { team_number: '2', player_names: 'E / F', group_name: 'Group B', status: 'active' },
    { team_number: '10', player_names: 'G / H', group_name: 'Group A', status: null },
  ];
  const roster = kheloRosterForGroup(rows, 'Group A');
  assert.deepEqual(roster, [
    ['3', 'A / B'],
    ['10', 'G / H'],
  ]);
});

test('mapKheloMatch: maps KheloHQ columns onto the scheduler Match shape', () => {
  const mapped = mapKheloMatch({
    id: 'm1',
    matchup: 'Team #3 vs Team #10',
    match_date: '2026-09-20',
    match_time: '18:00',
    court: 'Court 1',
    status: 'Completed',
    result: 'Team #10 def. Team #3, 6-3, 6-4',
    group_name: 'Group A',
    stage: 'group',
    knockout_slot: null,
    excluded_from_standings: false,
    standings_override: null,
    verification_status: 'confirmed',
  });
  assert.equal(mapped.id, 'm1');
  assert.equal(mapped.matchup, 'Team #3 vs Team #10');
  assert.equal(mapped.match_date, '2026-09-20');
  assert.equal(mapped.status, 'Completed');
  assert.equal(mapped.result, 'Team #10 def. Team #3, 6-3, 6-4');
  assert.equal(mapped.league_group, 'Group A');
  assert.equal(mapped.excluded_from_standings, false);
  assert.equal(mapped.standings_override, null);
});

test('mapKheloMatch: nulls become scheduler-safe defaults', () => {
  const mapped = mapKheloMatch({
    id: 'm2',
    matchup: 'Team #1 vs Team #2',
    match_date: null,
    match_time: null,
    court: null,
    status: null,
    result: null,
    group_name: null,
    stage: null,
    knockout_slot: null,
    excluded_from_standings: null,
    standings_override: null,
    verification_status: null,
  });
  assert.equal(mapped.match_date, '');
  assert.equal(mapped.status, '');
  assert.equal(mapped.result, null);
  assert.equal(mapped.league_group, undefined);
  assert.equal(mapped.excluded_from_standings, false);
});
