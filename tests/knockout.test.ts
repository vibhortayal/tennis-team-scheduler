import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedQuarterfinals,
  derivePhase,
  nextRoundFixtures,
  knockoutWinnerId,
  canReseed,
  groupStageBlockers,
  buildBracket,
  nextKnockoutFixture,
  hasDecidedDownstream,
  DOWNSTREAM_SLOT,
  QF_PAIRINGS,
  type KnockoutSlot,
} from '../app/lib/knockout.ts';
import type { Match } from '../app/lib/matches.ts';
import type { TeamStandingRow } from '../app/lib/scoring.ts';

const row = (teamId: string): TeamStandingRow => ({
  teamId,
  teamLabel: `#${teamId}`,
  players: 'A & B',
  group: 'Group A',
  totalMatches: 0,
  matchesPlayed: 0,
  matchesRemaining: 0,
  matchesWon: 0,
  matchesLost: 0,
  totalPoints: 0,
  netScoreRate: 0,
  gamesWon: 0,
  gamesLost: 0,
  groupRank: 0,
});

const standingsA = ['2', '5', '7', '9', '11'].map(row);
const standingsB = ['1', '3', '4', '6', '8'].map(row);

const koMatch = (overrides: Partial<Match> = {}): Match => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  matchup: 'Team #2 vs Team #1',
  match_date: '2026-10-05',
  match_time: '10:00',
  court: 'Court 2',
  status: 'Scheduled',
  stage: 'quarterfinal',
  knockout_slot: 'QF1',
  excluded_from_standings: true,
  ...overrides,
});

// ---------------------------------------------------------------- seeding

test('QF pairings follow the A1vB4 / A2vB3 / B1vA4 / B2vA3 format', () => {
  assert.deepEqual(
    QF_PAIRINGS.map((p) => [p.slot, p.first.group, p.first.rank, p.second.group, p.second.rank]),
    [
      ['QF1', 'Group A', 1, 'Group B', 4],
      ['QF2', 'Group A', 2, 'Group B', 3],
      ['QF3', 'Group B', 1, 'Group A', 4],
      ['QF4', 'Group B', 2, 'Group A', 3],
    ]
  );
});

test('seedQuarterfinals maps group ranks to team ids', () => {
  const seeds = seedQuarterfinals(standingsA, standingsB);
  assert.deepEqual(seeds, [
    { slot: 'QF1', stage: 'quarterfinal', firstId: '2', secondId: '6' },
    { slot: 'QF2', stage: 'quarterfinal', firstId: '5', secondId: '4' },
    { slot: 'QF3', stage: 'quarterfinal', firstId: '1', secondId: '9' },
    { slot: 'QF4', stage: 'quarterfinal', firstId: '3', secondId: '7' },
  ]);
});

test('seedQuarterfinals throws when a group has fewer than four teams', () => {
  assert.throws(() => seedQuarterfinals(standingsA.slice(0, 3), standingsB), /rank 4/);
});

// ---------------------------------------------------------------- winners

test('knockoutWinnerId returns the winner of a completed knockout match', () => {
  const m = koMatch({ status: 'Completed', result: '6-4, 6-4' });
  assert.equal(knockoutWinnerId(m), '2');
});

test('knockoutWinnerId honors a walkover override', () => {
  const m = koMatch({
    status: 'Completed',
    result: '6-0, 6-0',
    standings_override: {
      reason: 'walkover',
      winnerTeamId: '1',
      loserTeamId: '2',
      score: { set1: { teamA: 6, teamB: 0 }, set2: { teamA: 6, teamB: 0 } },
    },
  });
  assert.equal(knockoutWinnerId(m), '1');
});

test('knockoutWinnerId is null for undecided or group matches', () => {
  assert.equal(knockoutWinnerId(koMatch()), null);
  assert.equal(
    knockoutWinnerId(
      koMatch({ status: 'Completed', result: '6-4, 6-4', stage: 'group', knockout_slot: null })
    ),
    null
  );
});

// ------------------------------------------------------------- advancement

const decided = (slot: KnockoutSlot, winnerId: string, loserId: string): Match =>
  koMatch({
    knockout_slot: slot,
    matchup: `Team #${winnerId} vs Team #${loserId}`,
    status: 'Completed',
    result: '6-3, 6-3',
  });

test('nextRoundFixtures builds SF1 once QF1 and QF4 are decided', () => {
  const fixtures = nextRoundFixtures([decided('QF1', '2', '6'), decided('QF4', '3', '7')]);
  assert.deepEqual(fixtures, [{ slot: 'SF1', stage: 'semifinal', firstId: '2', secondId: '3' }]);
});

test('nextRoundFixtures waits for both feeders before proposing a fixture', () => {
  assert.deepEqual(nextRoundFixtures([decided('QF1', '2', '6')]), []);
});

test('nextRoundFixtures builds the final once both semifinals are decided', () => {
  const matches = [
    decided('QF1', '2', '6'),
    decided('QF4', '3', '7'),
    decided('SF1', '2', '3'),
    decided('SF2', '5', '1'),
  ].map((m, i) => ({ ...m, stage: i < 2 ? 'quarterfinal' : 'semifinal' }));
  const fixtures = nextRoundFixtures(matches);
  // SF2 itself is not proposed: its feeders (QF2/QF3) are not in this set.
  // SF1 is proposed from its known QF winners; F from the two SF winners.
  assert.deepEqual(fixtures, [
    { slot: 'SF1', stage: 'semifinal', firstId: '2', secondId: '3' },
    { slot: 'F', stage: 'final', firstId: '2', secondId: '5' },
  ]);
});

test('downstream slots keep group winners apart until the final', () => {
  assert.deepEqual(DOWNSTREAM_SLOT, {
    QF1: 'SF1',
    QF4: 'SF1',
    QF2: 'SF2',
    QF3: 'SF2',
    SF1: 'F',
    SF2: 'F',
    F: null,
  });
});

// ------------------------------------------------------------------ phase

const groupMatch = (overrides: Partial<Match> = {}): Match => ({
  id: `g-${Math.random().toString(36).slice(2)}`,
  matchup: 'Team #2 vs Team #5',
  match_date: '2026-09-20',
  match_time: '10:00',
  court: 'Court 2',
  status: 'Completed',
  result: '6-4, 6-4',
  league_group: 'Group A',
  ...overrides,
});

test('derivePhase walks group -> QF -> SF -> F -> complete', () => {
  assert.equal(derivePhase([groupMatch()]), 'group');
  assert.equal(derivePhase([groupMatch(), koMatch()]), 'quarterfinal');
  assert.equal(
    derivePhase([groupMatch(), koMatch(), koMatch({ knockout_slot: 'SF1', stage: 'semifinal' })]),
    'semifinal'
  );
  assert.equal(
    derivePhase([groupMatch(), koMatch({ knockout_slot: 'F', stage: 'final' })]),
    'final'
  );
  assert.equal(
    derivePhase([
      groupMatch(),
      koMatch({ knockout_slot: 'F', stage: 'final', status: 'Completed', result: '6-4, 6-4' }),
    ]),
    'complete'
  );
});

// ---------------------------------------------------------------- blockers

test('groupStageBlockers flags only unresolved group fixtures', () => {
  const blockers = groupStageBlockers([
    groupMatch({ status: 'Scheduled', result: undefined }),
    groupMatch({ status: 'Completed' }),
    groupMatch({ status: 'Cancelled' }),
    groupMatch({ status: 'Scheduled', result: undefined, excluded_from_standings: true }),
    koMatch(),
  ]);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].status, 'Scheduled');
});

// ----------------------------------------------------------------- reseeds

test('canReseed is true while no QF is decided', () => {
  assert.equal(canReseed([koMatch(), koMatch({ knockout_slot: 'QF2' })]), true);
});

test('canReseed is false once any QF is decided or no QFs exist', () => {
  assert.equal(canReseed([decided('QF1', '2', '6')]), false);
  assert.equal(canReseed([groupMatch()]), false);
});

// ----------------------------------------------------------------- bracket

test('buildBracket returns all seven slots with feeder labels when undecided', () => {
  const bracket = buildBracket([]);
  assert.equal(bracket.length, 7);
  assert.deepEqual(
    bracket.map((s) => s.slot),
    ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F']
  );
  const sf1 = bracket.find((s) => s.slot === 'SF1')!;
  assert.equal(sf1.firstLabel, 'Winner QF1');
  assert.equal(sf1.secondLabel, 'Winner QF4');
  const f = bracket.find((s) => s.slot === 'F')!;
  assert.equal(f.firstLabel, 'Winner SF1');
});

test('buildBracket resolves teams and winners from matches', () => {
  const seeds = new Map<KnockoutSlot, { firstId: string; secondId: string }>([
    ['QF1', { firstId: '2', secondId: '6' }],
  ]);
  const bracket = buildBracket([decided('QF1', '2', '6')], seeds);
  const qf1 = bracket.find((s) => s.slot === 'QF1')!;
  assert.equal(qf1.decided, true);
  assert.equal(qf1.winnerId, '2');
  assert.ok(qf1.firstLabel.includes('#2'));
});

test('nextKnockoutFixture finds a team’s upcoming knockout match', () => {
  const matches = [
    decided('QF1', '2', '6'),
    koMatch({ knockout_slot: 'SF1', stage: 'semifinal', matchup: 'Team #2 vs Team #3' }),
  ];
  const next = nextKnockoutFixture(matches, '2');
  assert.equal(next?.knockout_slot, 'SF1');
  assert.equal(nextKnockoutFixture(matches, '9'), null);
});

test('hasDecidedDownstream blocks editing a feeder once downstream is decided', () => {
  const qf = koMatch({ knockout_slot: 'QF1', matchup: 'Team #1 vs Team #8' });
  const sf = decided('SF1', '1', '4');
  assert.equal(hasDecidedDownstream([qf, sf], 'QF1'), true);
  assert.equal(hasDecidedDownstream([qf], 'QF1'), false);
  assert.equal(hasDecidedDownstream([qf, sf], 'F'), false);
  assert.equal(hasDecidedDownstream([qf, sf], null), false);
});

// ------------------------------------------------- null-date regression

test('compareMatchDateTimeAsc/Desc tolerate null dates and sort them last', async () => {
  const { compareMatchDateTimeAsc, compareMatchDateTimeDesc } =
    await import('../app/lib/matches.ts');
  const undated = koMatch({
    match_date: null as unknown as string,
    match_time: null as unknown as string,
  });
  const dated = koMatch({ match_date: '2026-10-05', match_time: '10:00' });
  const earlier = koMatch({ match_date: '2026-10-01', match_time: '09:00' });

  // no throw, undated sorts last in both directions
  const asc = [undated, dated, earlier].sort(compareMatchDateTimeAsc);
  assert.equal(asc[0].match_date, '2026-10-01');
  assert.equal(asc[2].match_date, null);
  const desc = [undated, earlier, dated].sort(compareMatchDateTimeDesc);
  assert.equal(desc[0].match_date, '2026-10-05');
  assert.equal(desc[2].match_date, null);
});

test('nextKnockoutFixture tolerates seeded quarterfinals with null dates', () => {
  // seedQuarterfinals POST bodies omit match_date/match_time; the DB returns null.
  const undated = (slot: string, matchup: string) =>
    koMatch({
      knockout_slot: slot as 'QF1',
      matchup,
      match_date: null as unknown as string,
      match_time: null as unknown as string,
      status: 'unscheduled',
    });
  const matches = [undated('QF1', 'Team #5 vs Team #13'), undated('QF2', 'Team #12 vs Team #10')];
  const next = nextKnockoutFixture(matches, '5');
  assert.equal(next?.knockout_slot, 'QF1');
  assert.equal(nextKnockoutFixture(matches, '99'), null);
});
