/**
 * Pure helpers for the read-only "Team Match History" view.
 * No React, no Supabase, no side effects.
 *
 * All data is derived from the client-side `matches` collection and the
 * existing `Match` type - no new API endpoints or database queries.
 */

import { Group } from '../teams';
import { Match, matchIncludesTeam, teamIds } from './matches';
import { matchWinner } from './scoring';

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

/** Statuses the app already treats as finalized (see withdrawal handling). */
const FINALIZED_STATUSES = new Set(['completed', 'retired', 'walkover']);

export const isFinalizedStatus = (status: string): boolean =>
  FINALIZED_STATUSES.has(status.trim().toLowerCase());

export const isScheduledStatus = (status: string): boolean =>
  status.trim().toLowerCase() === 'scheduled';

export const isVoidedStatus = (status: string): boolean => status.trim().toLowerCase() === 'voided';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamMatchOutcome = 'win' | 'loss' | 'unknown';

export type TeamMatchEntry = {
  match: Match;
  /** Opponent team id, or null when it cannot be determined from the matchup. */
  opponentId: string | null;
  /** Result from the selected team's perspective (meaningful for finalized matches). */
  outcome: TeamMatchOutcome;
  /** True when excluded from standings or voided - shown with a label, not hidden. */
  excluded: boolean;
};

export type TeamMatchHistory = {
  completed: TeamMatchEntry[];
  upcoming: TeamMatchEntry[];
};

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

/**
 * Opponent of `teamId` in the given match. Falls back to a raw matchup-string
 * parse when the roster-based `teamIds` lookup finds nothing (e.g. the
 * opponent has been withdrawn from the active roster).
 */
export function opponentIdFor(match: Match, teamId: string, group: Group): string | null {
  const fromRoster = teamIds(match, group).find((id) => id !== teamId);
  if (fromRoster) return fromRoster;
  const fromMatchup = Array.from(match.matchup.matchAll(/Team #(\d+)/g), (m) => m[1]).find(
    (id) => id !== teamId
  );
  return fromMatchup ?? null;
}

/**
 * Whether `teamId` is the first team in the matchup string, following the
 * same convention as standings computation in scoring.ts.
 */
export function isFirstTeamInMatchup(match: Match, teamId: string, group: Group): boolean {
  const ids = teamIds(match, group);
  if (ids.length > 0) return ids[0] === teamId;
  const index = match.matchup.indexOf(`Team #${teamId}`);
  if (index === -1) return false;
  const versus = match.matchup.indexOf('vs');
  return versus === -1 || index < versus;
}

/**
 * Result of a finalized match from `teamId`'s perspective.
 * Prefers an explicit `standings_override` winner/loser when present
 * (e.g. walkovers recorded for withdrawn teams), then falls back to parsing
 * the stored result string.
 */
export function outcomeForTeam(match: Match, teamId: string, group: Group): TeamMatchOutcome {
  const override = match.standings_override;
  if (override) {
    if (override.winnerTeamId === teamId) return 'win';
    if (override.loserTeamId === teamId) return 'loss';
  }
  const result = match.result?.trim();
  if (!result) return 'unknown';
  const winner = matchWinner(result);
  if (!winner) return 'unknown';
  const isTeamA = isFirstTeamInMatchup(match, teamId, group);
  return (winner === 'a') === isTeamA ? 'win' : 'loss';
}

const byDateDesc = (a: Match, b: Match) =>
  b.match_date.localeCompare(a.match_date) || b.match_time.localeCompare(a.match_time);

const byDateAsc = (a: Match, b: Match) =>
  a.match_date.localeCompare(b.match_date) || a.match_time.localeCompare(b.match_time);

/**
 * Split a team's matches into completed (finalized statuses, newest first)
 * and upcoming (scheduled, soonest first).
 *
 * - Scoped to `group` using the same `(league_group || 'Group B')` fallback
 *   the rest of the app uses.
 * - Cancelled and voided records never appear as upcoming.
 * - Matches excluded from standings (or voided) stay visible in the
 *   completed list with `excluded: true` so the UI can label them instead of
 *   silently treating them as normal standings results.
 */
export function teamMatchHistory(
  allMatches: Match[],
  group: Group,
  teamId: string
): TeamMatchHistory {
  const teamMatches = allMatches.filter(
    (match) =>
      (match.league_group || 'Group B') === group && matchIncludesTeam(match.matchup, teamId)
  );

  const completed: TeamMatchEntry[] = teamMatches
    .filter((match) => isFinalizedStatus(match.status))
    .sort(byDateDesc)
    .map((match) => ({
      match,
      opponentId: opponentIdFor(match, teamId, group),
      outcome: outcomeForTeam(match, teamId, group),
      excluded: match.excluded_from_standings === true || isVoidedStatus(match.status),
    }));

  const upcoming: TeamMatchEntry[] = teamMatches
    .filter((match) => isScheduledStatus(match.status))
    .sort(byDateAsc)
    .map((match) => ({
      match,
      opponentId: opponentIdFor(match, teamId, group),
      outcome: 'unknown' as TeamMatchOutcome,
      excluded: false,
    }));

  return { completed, upcoming };
}
