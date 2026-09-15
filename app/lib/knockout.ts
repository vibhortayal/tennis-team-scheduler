import type { Group } from '../teams';
import { teamDisplay } from '../teams';
import type { Match } from './matches';
import { teamIds, compareMatchDateTimeAsc } from './matches';
import type { TeamStandingRow } from './scoring';
import { applyStandingsOverride, matchWinner } from './scoring';

export type Stage = 'group' | 'quarterfinal' | 'semifinal' | 'final';
export type KnockoutSlot = 'QF1' | 'QF2' | 'QF3' | 'QF4' | 'SF1' | 'SF2' | 'F';
export type Phase = 'group' | 'quarterfinal' | 'semifinal' | 'final' | 'complete';

export const STAGES: Stage[] = ['group', 'quarterfinal', 'semifinal', 'final'];
export const KNOCKOUT_SLOTS: KnockoutSlot[] = ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'];

/** The stage of a match; rows written before migration 007 read as 'group'. */
export const matchStage = (match: Pick<Match, 'stage'>): Stage => {
  const value = (match.stage || 'group') as Stage;
  return (STAGES as string[]).includes(value) ? value : 'group';
};

export const isKnockoutMatch = (match: Match): boolean => matchStage(match) !== 'group';

export const knockoutMatches = (matches: Match[]): Match[] => matches.filter(isKnockoutMatch);

/** Short badge label for a knockout stage. Null for group-stage matches. */
export const stageBadge = (match: Match): string | null => {
  switch (matchStage(match)) {
    case 'quarterfinal':
      return 'QF';
    case 'semifinal':
      return 'SF';
    case 'final':
      return 'F';
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

type SeedRef = { group: Group; rank: number };

export const QF_PAIRINGS: ReadonlyArray<{
  slot: KnockoutSlot;
  first: SeedRef;
  second: SeedRef;
}> = [
  { slot: 'QF1', first: { group: 'Group A', rank: 1 }, second: { group: 'Group B', rank: 4 } },
  { slot: 'QF2', first: { group: 'Group A', rank: 2 }, second: { group: 'Group B', rank: 3 } },
  { slot: 'QF3', first: { group: 'Group B', rank: 1 }, second: { group: 'Group A', rank: 4 } },
  { slot: 'QF4', first: { group: 'Group B', rank: 2 }, second: { group: 'Group A', rank: 3 } },
];

const teamIdAtRank = (standings: TeamStandingRow[], rank: number): string => {
  const row = standings[rank - 1];
  if (!row) throw new Error(`Cannot seed: no team at rank ${rank}.`);
  return row.teamId;
};

/**
 * Builds the four quarterfinal fixtures from final group standings.
 * Throws when a group has fewer than four ranked teams.
 */
export function seedQuarterfinals(
  standingsA: TeamStandingRow[],
  standingsB: TeamStandingRow[]
): Array<{ slot: KnockoutSlot; stage: Stage; firstId: string; secondId: string }> {
  const byGroup: Record<Group, TeamStandingRow[]> = {
    'Group A': standingsA,
    'Group B': standingsB,
  };
  return QF_PAIRINGS.map(({ slot, first, second }) => ({
    slot,
    stage: 'quarterfinal' as Stage,
    firstId: teamIdAtRank(byGroup[first.group], first.rank),
    secondId: teamIdAtRank(byGroup[second.group], second.rank),
  }));
}

// ---------------------------------------------------------------------------
// Advancement
// ---------------------------------------------------------------------------

const SF_FEEDERS: Record<'SF1' | 'SF2', [KnockoutSlot, KnockoutSlot]> = {
  SF1: ['QF1', 'QF4'],
  SF2: ['QF2', 'QF3'],
};

export const DOWNSTREAM_SLOT: Record<KnockoutSlot, KnockoutSlot | null> = {
  QF1: 'SF1',
  QF4: 'SF1',
  QF2: 'SF2',
  QF3: 'SF2',
  SF1: 'F',
  SF2: 'F',
  F: null,
};

/**
 * Whether the slot fed by `slot` already has a decided match. Editing the
 * feeder result afterwards would silently invalidate the downstream fixture,
 * so callers should block it and ask the user to update downstream first.
 */
export function hasDecidedDownstream(matches: Match[], slot: string | null | undefined): boolean {
  const downstream = slot && slot in DOWNSTREAM_SLOT ? DOWNSTREAM_SLOT[slot as KnockoutSlot] : null;
  if (!downstream) return false;
  return matches.some((m) => m.knockout_slot === downstream && knockoutWinnerId(m) !== null);
}

/**
 * The winning team id of a completed knockout match, honoring
 * standings overrides (admin-awarded walkovers). Null when undecided.
 */
export function knockoutWinnerId(match: Match): string | null {
  if (!isKnockoutMatch(match)) return null;
  if (match.status !== 'Completed') return null;
  // applyStandingsOverride (not getEffectiveStandingsMatch): knockout matches
  // are excluded from standings but still need winner resolution, including
  // admin-awarded walkovers.
  const effective = applyStandingsOverride(match);
  if (!effective?.result?.trim()) return null;
  const winner = matchWinner(effective.result);
  if (!winner) return null;
  // Knockout fixtures span both groups; allKnownTeams resolves either side.
  // Use the effective match so walkover overrides (rewritten matchup) resolve
  // to the awarded winner.
  const ids = teamIds(effective, 'Group A');
  if (ids.length !== 2) return null;
  return winner === 'a' ? ids[0] : ids[1];
}

/**
 * Downstream fixtures whose feeder winners are both known. A fixture is
 * only proposed once both teams are decided — no TBD placeholders.
 */
export function nextRoundFixtures(
  matches: Match[]
): Array<{ slot: 'SF1' | 'SF2' | 'F'; stage: Stage; firstId: string; secondId: string }> {
  const bySlot = new Map(knockoutMatches(matches).map((m) => [m.knockout_slot as KnockoutSlot, m]));
  const winnerOf = (slot: KnockoutSlot): string | null => {
    const m = bySlot.get(slot);
    return m ? knockoutWinnerId(m) : null;
  };

  const fixtures: Array<{
    slot: 'SF1' | 'SF2' | 'F';
    stage: Stage;
    firstId: string;
    secondId: string;
  }> = [];

  (Object.keys(SF_FEEDERS) as Array<'SF1' | 'SF2'>).forEach((slot) => {
    const [feederA, feederB] = SF_FEEDERS[slot];
    const firstId = winnerOf(feederA);
    const secondId = winnerOf(feederB);
    if (firstId && secondId) {
      fixtures.push({ slot, stage: 'semifinal', firstId, secondId });
    }
  });

  const finalA = winnerOf('SF1');
  const finalB = winnerOf('SF2');
  if (finalA && finalB) {
    fixtures.push({ slot: 'F', stage: 'final', firstId: finalA, secondId: finalB });
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Tournament phase
// ---------------------------------------------------------------------------

/** Derived from the data: no stored phase flag to drift out of sync. */
export function derivePhase(matches: Match[]): Phase {
  const ko = knockoutMatches(matches);
  if (ko.length === 0) return 'group';
  const final = ko.find((m) => m.knockout_slot === 'F');
  if (final && final.status === 'Completed') return 'complete';
  if (final) return 'final';
  if (ko.some((m) => m.knockout_slot === 'SF1' || m.knockout_slot === 'SF2')) return 'semifinal';
  return 'quarterfinal';
}

export const PHASE_LABELS: Record<Phase, string> = {
  group: 'Group Stage',
  quarterfinal: 'Quarterfinals',
  semifinal: 'Semifinals',
  final: 'Final',
  complete: 'Tournament Complete',
};

/** Group-stage matches still blocking "end group stage". */
export const isGroupStageBlocker = (match: Match): boolean =>
  matchStage(match) === 'group' &&
  !match.excluded_from_standings &&
  (match.status === 'Scheduled' || match.status === 'unscheduled');

export const groupStageBlockers = (matches: Match[]): Match[] =>
  matches.filter(isGroupStageBlocker);

/**
 * Re-seeding is only safe while no quarterfinal has been decided; once a QF
 * has a result the bracket is live history.
 */
export const canReseed = (matches: Match[]): boolean => {
  const qfs = knockoutMatches(matches).filter((m) => (m.knockout_slot || '').startsWith('QF'));
  return qfs.length > 0 && qfs.every((m) => knockoutWinnerId(m) === null);
};

// ---------------------------------------------------------------------------
// Bracket view model (pure; the component renders it)
// ---------------------------------------------------------------------------

export type BracketSlotView = {
  slot: KnockoutSlot;
  stage: Stage;
  stageLabel: string;
  firstId: string | null;
  secondId: string | null;
  firstLabel: string;
  secondLabel: string;
  winnerId: string | null;
  match: Match | null;
  decided: boolean;
};

const STAGE_LABELS: Record<Stage, string> = {
  group: 'Group',
  quarterfinal: 'Quarterfinal',
  semifinal: 'Semifinal',
  final: 'Final',
};

const SLOT_STAGE: Record<KnockoutSlot, Stage> = {
  QF1: 'quarterfinal',
  QF2: 'quarterfinal',
  QF3: 'quarterfinal',
  QF4: 'quarterfinal',
  SF1: 'semifinal',
  SF2: 'semifinal',
  F: 'final',
};

const feederLabel = (slot: KnockoutSlot): string => `Winner ${slot}`;

function slotTeams(
  slot: KnockoutSlot,
  bySlot: Map<KnockoutSlot, Match>,
  seeds: Map<KnockoutSlot, { firstId: string; secondId: string }>
): { firstId: string | null; secondId: string | null; firstLabel: string; secondLabel: string } {
  const match = bySlot.get(slot);
  if (match) {
    const ids = teamIds(match, 'Group A');
    const [a, b] = [ids[0] ?? null, ids[1] ?? null];
    return {
      firstId: a,
      secondId: b,
      firstLabel: a ? teamDisplay('Group A', a) : match.matchup,
      secondLabel: b ? teamDisplay('Group A', b) : '',
    };
  }
  const seed = seeds.get(slot);
  if (seed) {
    return {
      firstId: seed.firstId,
      secondId: seed.secondId,
      firstLabel: teamDisplay('Group A', seed.firstId),
      secondLabel: teamDisplay('Group A', seed.secondId),
    };
  }
  // Not seeded/created yet: show where the teams come from.
  if (slot === 'SF1' || slot === 'SF2') {
    const [fa, fb] = SF_FEEDERS[slot];
    return {
      firstId: null,
      secondId: null,
      firstLabel: feederLabel(fa),
      secondLabel: feederLabel(fb),
    };
  }
  return {
    firstId: null,
    secondId: null,
    firstLabel: feederLabel('SF1'),
    secondLabel: feederLabel('SF2'),
  };
}

/**
 * All seven slots in bracket order, each resolved to teams (or feeder
 * labels when undecided) plus the underlying match when one exists.
 * `seeds` lets the bracket preview show QF pairings before fixtures exist.
 */
export function buildBracket(
  matches: Match[],
  seeds: Map<KnockoutSlot, { firstId: string; secondId: string }> = new Map()
): BracketSlotView[] {
  const bySlot = new Map<KnockoutSlot, Match>();
  for (const m of knockoutMatches(matches)) {
    if (m.knockout_slot && (KNOCKOUT_SLOTS as string[]).includes(m.knockout_slot)) {
      bySlot.set(m.knockout_slot as KnockoutSlot, m);
    }
  }
  return KNOCKOUT_SLOTS.map((slot) => {
    const match = bySlot.get(slot) ?? null;
    const teams = slotTeams(slot, bySlot, seeds);
    const winnerId = match ? knockoutWinnerId(match) : null;
    return {
      slot,
      stage: SLOT_STAGE[slot],
      stageLabel: STAGE_LABELS[SLOT_STAGE[slot]],
      firstId: teams.firstId,
      secondId: teams.secondId,
      firstLabel: teams.firstLabel,
      secondLabel: teams.secondLabel,
      winnerId,
      match,
      decided: winnerId !== null,
    };
  });
}

/** The next undecided knockout fixture involving a team, if any. */
export function nextKnockoutFixture(matches: Match[], teamId: string): Match | null {
  if (!teamId) return null;
  const upcoming = knockoutMatches(matches)
    .filter((m) => {
      const ids = teamIds(m, 'Group A');
      return ids.includes(teamId) && knockoutWinnerId(m) === null;
    })
    .sort(compareMatchDateTimeAsc);
  return upcoming[0] ?? null;
}

/** Whether a team is still alive in the knockout phase. */
export function isKnockoutQualified(
  matches: Match[],
  standingsA: TeamStandingRow[],
  standingsB: TeamStandingRow[],
  teamId: string
): boolean {
  if (!teamId) return false;
  const qualified = new Set<string>();
  for (const row of [...standingsA.slice(0, 4), ...standingsB.slice(0, 4)]) {
    qualified.add(row.teamId);
  }
  // A team also qualifies by appearing in any knockout fixture (covers re-seeds).
  for (const m of knockoutMatches(matches)) {
    for (const id of teamIds(m, 'Group A')) qualified.add(id);
  }
  return qualified.has(teamId);
}
