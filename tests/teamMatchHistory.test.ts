import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  teamMatchHistory,
  isFinalizedStatus,
  isScheduledStatus,
  outcomeForTeam,
  opponentIdFor,
} from '../app/lib/teamMatchHistory.ts';
import type { Match } from '../app/lib/matches.ts';
import {
  TeamMatchHistoryModal,
  TEAM_HISTORY_EMPTY_COMPLETED,
  TEAM_HISTORY_EMPTY_UPCOMING,
} from '../app/components/TeamMatchHistoryModal.tsx';

const base = (over: Partial<Match>): Match => ({
  id: 'x',
  matchup: 'Team #3 vs Team #4',
  match_date: '2026-08-01',
  match_time: '10:00',
  court: 'Court 2',
  status: 'Scheduled',
  league_group: 'Group B',
  ...over,
});

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

test('isFinalizedStatus classifies Completed, Retired and Walkover as finalized', () => {
  assert.equal(isFinalizedStatus('Completed'), true);
  assert.equal(isFinalizedStatus('Retired'), true);
  assert.equal(isFinalizedStatus('Walkover'), true);
  assert.equal(isFinalizedStatus('Scheduled'), false);
  assert.equal(isFinalizedStatus('Cancelled'), false);
  assert.equal(isFinalizedStatus('voided'), false);
});

test('isScheduledStatus only matches scheduled matches', () => {
  assert.equal(isScheduledStatus('Scheduled'), true);
  assert.equal(isScheduledStatus('Completed'), false);
  assert.equal(isScheduledStatus('Cancelled'), false);
  assert.equal(isScheduledStatus('voided'), false);
});

// ---------------------------------------------------------------------------
// Filtering: team participation and group scope
// ---------------------------------------------------------------------------

test('a team only sees matches it participates in (with team-id boundary safety)', () => {
  const matches: Match[] = [
    base({ id: '1', status: 'Completed', result: '6-3, 6-4' }),
    base({ id: '2', matchup: 'Team #1 vs Team #6', status: 'Completed', result: '6-3, 6-4' }),
    // Team #13 must not match team "3".
    base({ id: '3', matchup: 'Team #13 vs Team #10', status: 'Completed', result: '6-3, 6-4' }),
    // Cross-group record must not leak into Group B history.
    base({
      id: '4',
      matchup: 'Team #3 vs Team #2',
      status: 'Completed',
      result: '6-3, 6-4',
      league_group: 'Group A',
    }),
  ];
  const { completed } = teamMatchHistory(matches, 'Group B', '3');
  assert.deepEqual(
    completed.map((e) => e.match.id),
    ['1']
  );
});

test('matches without an explicit league_group default to Group B', () => {
  const matches: Match[] = [base({ id: '1', status: 'Completed', result: '6-3, 6-4' })];
  delete matches[0].league_group;
  const { completed } = teamMatchHistory(matches, 'Group B', '3');
  assert.equal(completed.length, 1);
  const forA = teamMatchHistory(matches, 'Group A', '3');
  assert.equal(forA.completed.length, 0);
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

test('completed matches are sorted newest first (date, then time)', () => {
  const matches: Match[] = [
    base({ id: 'old', match_date: '2026-08-01', status: 'Completed', result: '6-3, 6-4' }),
    base({ id: 'new', match_date: '2026-08-10', status: 'Completed', result: '6-3, 6-4' }),
    base({ id: 'mid', match_date: '2026-08-05', status: 'Completed', result: '6-3, 6-4' }),
    base({
      id: 'same-day-late',
      match_date: '2026-08-10',
      match_time: '18:00',
      status: 'Completed',
      result: '6-3, 6-4',
    }),
    base({
      id: 'same-day-early',
      match_date: '2026-08-10',
      match_time: '09:00',
      status: 'Completed',
      result: '6-3, 6-4',
    }),
  ];
  const { completed } = teamMatchHistory(matches, 'Group B', '3');
  // 'new' defaults to match_time 10:00, so it sorts between 18:00 and 09:00.
  assert.deepEqual(
    completed.map((e) => e.match.id),
    ['same-day-late', 'new', 'same-day-early', 'mid', 'old']
  );
});

test('upcoming matches are sorted soonest first', () => {
  const matches: Match[] = [
    base({ id: 'later', match_date: '2026-09-20', status: 'Scheduled' }),
    base({ id: 'sooner', match_date: '2026-09-10', status: 'Scheduled' }),
    base({
      id: 'same-day-early',
      match_date: '2026-09-10',
      match_time: '09:00',
      status: 'Scheduled',
    }),
  ];
  const { upcoming } = teamMatchHistory(matches, 'Group B', '3');
  assert.deepEqual(
    upcoming.map((e) => e.match.id),
    ['same-day-early', 'sooner', 'later']
  );
});

// ---------------------------------------------------------------------------
// Classification details
// ---------------------------------------------------------------------------

test('Retired and Walkover matches are classified as completed, not upcoming', () => {
  const matches: Match[] = [
    base({ id: 'r', status: 'Retired', result: '6-1, 3-2' }),
    base({ id: 'w', status: 'Walkover', result: '6-0, 6-0' }),
    base({ id: 'c', status: 'Completed', result: '6-3, 6-4' }),
  ];
  const { completed, upcoming } = teamMatchHistory(matches, 'Group B', '3');
  assert.deepEqual(
    completed.map((e) => e.match.id),
    ['r', 'w', 'c']
  );
  assert.deepEqual(upcoming, []);
});

test('cancelled and voided matches never appear as upcoming', () => {
  const matches: Match[] = [
    base({ id: 'cancelled', status: 'Cancelled', cancellation_reason: 'rain' }),
    base({ id: 'voided', status: 'voided' }),
    base({ id: 'ok', status: 'Scheduled' }),
  ];
  const { completed, upcoming } = teamMatchHistory(matches, 'Group B', '3');
  assert.deepEqual(
    upcoming.map((e) => e.match.id),
    ['ok']
  );
  assert.deepEqual(completed, []);
});

test('excluded-from-standings matches stay visible in history with an excluded flag', () => {
  const matches: Match[] = [
    base({
      id: 'excluded',
      status: 'Completed',
      result: '6-3, 6-4',
      excluded_from_standings: true,
    }),
    base({ id: 'normal', status: 'Completed', result: '6-3, 6-4' }),
  ];
  const { completed } = teamMatchHistory(matches, 'Group B', '3');
  assert.equal(completed.length, 2);
  assert.equal(completed.find((e) => e.match.id === 'excluded')?.excluded, true);
  assert.equal(completed.find((e) => e.match.id === 'normal')?.excluded, false);
});

// ---------------------------------------------------------------------------
// Outcome and opponent derivation
// ---------------------------------------------------------------------------

test('outcomeForTeam derives Win/Loss from the selected team perspective', () => {
  const win = base({ status: 'Completed', result: '6-3, 6-4' });
  assert.equal(outcomeForTeam(win, '3', 'Group B'), 'win');
  assert.equal(outcomeForTeam(win, '4', 'Group B'), 'loss');

  const reversed = base({
    matchup: 'Team #4 vs Team #3',
    status: 'Completed',
    result: '6-3, 6-4',
  });
  assert.equal(outcomeForTeam(reversed, '3', 'Group B'), 'loss');
  assert.equal(outcomeForTeam(reversed, '4', 'Group B'), 'win');
});

test('outcomeForTeam prefers a standings_override winner/loser', () => {
  const walkover = base({
    status: 'Walkover',
    result: '6-0, 6-0',
    standings_override: {
      reason: 'team_withdrawal',
      winnerTeamId: '4',
      loserTeamId: '3',
      score: { set1: { teamA: 6, teamB: 0 }, set2: { teamA: 6, teamB: 0 } },
    },
  });
  assert.equal(outcomeForTeam(walkover, '4', 'Group B'), 'win');
  assert.equal(outcomeForTeam(walkover, '3', 'Group B'), 'loss');
});

test('outcomeForTeam is unknown when the result cannot be parsed', () => {
  const match = base({ status: 'Completed', result: '' });
  assert.equal(outcomeForTeam(match, '3', 'Group B'), 'unknown');
});

test('opponentIdFor returns the other team in the matchup', () => {
  assert.equal(opponentIdFor(base({}), '3', 'Group B'), '4');
  assert.equal(opponentIdFor(base({ matchup: 'Team #4 vs Team #3' }), '3', 'Group B'), '4');
});

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

test('a team with no matches gets empty completed and upcoming lists', () => {
  const matches: Match[] = [
    base({ id: '1', status: 'Completed', result: '6-3, 6-4' }),
    base({ id: '2', status: 'Scheduled' }),
  ];
  const history = teamMatchHistory(matches, 'Group B', '8');
  assert.deepEqual(history.completed, []);
  assert.deepEqual(history.upcoming, []);
});

test('empty-state copy matches the required strings', () => {
  assert.equal(TEAM_HISTORY_EMPTY_COMPLETED, 'No completed matches yet.');
  assert.equal(TEAM_HISTORY_EMPTY_UPCOMING, 'No upcoming matches scheduled.');
});

// ---------------------------------------------------------------------------
// Component behavior (server-rendered markup)
// ---------------------------------------------------------------------------

const renderModal = (matches: Match[], teamId = '3') =>
  renderToStaticMarkup(
    createElement(TeamMatchHistoryModal, {
      teamId,
      group: 'Group B',
      matches,
      onClose: () => {},
    })
  );

test('modal renders an accessible dialog titled with the selected team', () => {
  const html = renderModal([]);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Team 3 Match History/);
  assert.match(html, /aria-label="Close"|>Close</);
});

test('modal shows both empty states when the team has no matches', () => {
  const html = renderModal([]);
  assert.ok(html.includes(TEAM_HISTORY_EMPTY_COMPLETED));
  assert.ok(html.includes(TEAM_HISTORY_EMPTY_UPCOMING));
});

test('modal lists completed matches newest-first with Win/Loss badges and scores', () => {
  const matches: Match[] = [
    base({
      id: 'older-loss',
      match_date: '2026-08-01',
      status: 'Completed',
      result: '3-6, 4-6',
    }),
    base({
      id: 'newer-win',
      match_date: '2026-08-10',
      status: 'Completed',
      result: '6-3, 6-4',
    }),
  ];
  const html = renderModal(matches);
  const newerPos = html.indexOf('6-3, 6-4');
  const olderPos = html.indexOf('3-6, 4-6');
  assert.ok(newerPos !== -1 && olderPos !== -1 && newerPos < olderPos);
  assert.ok(html.includes('>Win<'));
  assert.ok(html.includes('>Loss<'));
  assert.ok(!html.includes(TEAM_HISTORY_EMPTY_COMPLETED));
});

test('modal labels Retired, Walkover and excluded-from-standings matches', () => {
  const matches: Match[] = [
    base({ id: 'r', match_date: '2026-08-03', status: 'Retired', result: '6-1, 3-2' }),
    base({ id: 'w', match_date: '2026-08-02', status: 'Walkover', result: '6-0, 6-0' }),
    base({
      id: 'x',
      match_date: '2026-08-01',
      status: 'Completed',
      result: '6-3, 6-4',
      excluded_from_standings: true,
    }),
  ];
  const html = renderModal(matches);
  assert.ok(html.includes('>Retired<'));
  assert.ok(html.includes('>Walkover<'));
  assert.ok(html.includes('Excluded from standings'));
});

test('modal lists upcoming matches soonest-first with date, time, court and status', () => {
  const matches: Match[] = [
    base({ id: 'later', match_date: '2026-09-20', match_time: '18:00', status: 'Scheduled' }),
    base({ id: 'sooner', match_date: '2026-09-10', match_time: '10:00', status: 'Scheduled' }),
    base({ id: 'cancelled', match_date: '2026-09-05', status: 'Cancelled' }),
    base({ id: 'voided', match_date: '2026-09-06', status: 'voided' }),
  ];
  const html = renderModal(matches);
  const soonerPos = html.indexOf('10:00');
  const laterPos = html.indexOf('18:00');
  assert.ok(soonerPos !== -1 && laterPos !== -1 && soonerPos < laterPos);
  assert.ok(html.includes('Court 2'));
  assert.ok(html.includes('>Scheduled<'));
  assert.ok(!html.includes(TEAM_HISTORY_EMPTY_UPCOMING));
});
