import { Group } from '../teams';
import { Match, matchIncludesTeam, teamIds } from './matches';
import { parseResultString, SetScore } from './scoring';

/**
 * Pure, read-only helpers for the "Team Match History" panel shown from the
 * Standings view. No React, no Supabase, no side effects — safe to unit test
 * in isolation, mirroring the convention used by scoring.ts.
 *
 * These helpers deliberately do NOT apply `standings_override` rewrites
 * (e.g. withdrawal walkovers). The history view shows the real recorded
 * score for a match and simply labels excluded/voided records, rather than
 * silently substituting a standings-only result.
 */

export type CompletedOutcome = 'Win' | 'Loss' | 'Unknown';

export type CompletedMatchEntry = {
  match: Match;
  opponentId: string | null;
  /** Outcome for the *selected* team, derived from the stored result string. */
  outcome: CompletedOutcome;
  /** True when this match is flagged excluded_from_standings. */
  isExcludedFromStandings: boolean;
};

export type UpcomingMatchEntry = {
  match: Match;
  opponentId: string | null;
};

export type TeamMatchHistory = {
  completed: CompletedMatchEntry[];
  upcoming: UpcomingMatchEntry[];
};

const FINALIZED_STATUSES = new Set(['completed', 'retired', 'walkover']);

/** Statuses that must never surface as "upcoming", beyond simply not being 'scheduled'. */
const NON_UPCOMING_STATUSES = new Set(['cancelled', 'voided']);

function normalizedStatus(status: string): string {
  return status.trim().toLowerCase();
}

/**
 * A match counts as finalized/completed history if its status is
 * Completed, Retired, or Walkover (case-insensitive). Matches with the
 * 'voided' status are treated as fully removed from team history (they
 * represent tournament records struck out entirely, not just excluded
 * from standings math) — see AGENTS.md notes on team withdrawal handling.
 *
 * ASSUMPTION: if 'voided' should instead remain visible-but-labeled in
 * completed history, adjust this predicate; the current behavior mirrors
 * computeStandings()'s treatment of `status === 'voided'` as excluded.
 */
export function isFinalizedMatchStatus(status: string): boolean {
  return FINALIZED_STATUSES.has(normalizedStatus(status));
}

/** A match counts as upcoming only when it is still 'Scheduled'. */
export function isUpcomingMatchStatus(status: string): boolean {
  const value = normalizedStatus(status);
  return value === 'scheduled' && !NON_UPCOMING_STATUSES.has(value);
}

function resolveOpponentId(
  match: Match,
  group: Group,
  teamId: string,
  roster?: Parameters<typeof teamIds>[2]
): string | null {
  const ids = teamIds(match, group, roster);
  const opponent = ids.find((id) => id !== teamId);
  return opponent ?? null;
}

/**
 * Determine the selected team's Win/Loss outcome from the stored result
 * string, using the same "first id in matchup = team A" convention as
 * scoring.ts. Returns 'Unknown' when the result is missing or unparseable
 * (e.g. a Retired/Walkover match recorded without a full score).
 */
function deriveOutcome(
  match: Match,
  group: Group,
  teamId: string,
  roster?: Parameters<typeof teamIds>[2]
): CompletedOutcome {
  const result = match.result;
  if (!result || !result.trim()) return 'Unknown';

  const scores = parseResultString(result);
  if (!scores || !scores.set1 || !scores.set2) return 'Unknown';

  const sets = [scores.set1, scores.set2, scores.set3].filter(
    (s): s is SetScore => s !== undefined
  );
  const aWins = sets.filter((s) => s.teamA > s.teamB).length;
  const bWins = sets.filter((s) => s.teamB > s.teamA).length;

  const ids = teamIds(match, group, roster);
  const isTeamA = ids[0] === teamId;

  if (aWins >= 2) return isTeamA ? 'Win' : 'Loss';
  if (bWins >= 2) return isTeamA ? 'Loss' : 'Win';
  return 'Unknown';
}

/**
 * Completed matches (Completed / Retired / Walkover) for a team, within a
 * single group, sorted newest first.
 */
export function getCompletedMatchesForTeam(
  allMatches: readonly Match[],
  group: Group,
  teamId: string,
  roster?: Parameters<typeof teamIds>[2]
): CompletedMatchEntry[] {
  return allMatches
    .filter((m) => (m.league_group || 'Group B') === group)
    .filter((m) => matchIncludesTeam(m.matchup, teamId))
    .filter((m) => isFinalizedMatchStatus(m.status))
    .map((m) => ({
      match: m,
      opponentId: resolveOpponentId(m, group, teamId, roster),
      outcome: deriveOutcome(m, group, teamId, roster),
      isExcludedFromStandings: !!m.excluded_from_standings,
    }))
    .sort((a, b) => b.match.match_date.localeCompare(a.match.match_date));
}

/**
 * Upcoming (still-scheduled) matches for a team, within a single group,
 * sorted soonest first. Cancelled and voided records are never included.
 */
export function getUpcomingMatchesForTeam(
  allMatches: readonly Match[],
  group: Group,
  teamId: string,
  roster?: Parameters<typeof teamIds>[2]
): UpcomingMatchEntry[] {
  return allMatches
    .filter((m) => (m.league_group || 'Group B') === group)
    .filter((m) => matchIncludesTeam(m.matchup, teamId))
    .filter((m) => isUpcomingMatchStatus(m.status))
    .map((m) => ({
      match: m,
      opponentId: resolveOpponentId(m, group, teamId, roster),
    }))
    .sort((a, b) => a.match.match_date.localeCompare(b.match.match_date));
}

/** Convenience wrapper returning both lists for the match-history modal. */
export function getTeamMatchHistory(
  allMatches: readonly Match[],
  group: Group,
  teamId: string,
  roster?: Parameters<typeof teamIds>[2]
): TeamMatchHistory {
  return {
    completed: getCompletedMatchesForTeam(allMatches, group, teamId, roster),
    upcoming: getUpcomingMatchesForTeam(allMatches, group, teamId, roster),
  };
}
