import { Group } from '../teams';
import { Match, fremontNow, matchDateTime, matchIncludesTeam } from './matches';

/**
 * Identity-scoped match selection for the personalized "My Matches" panel.
 *
 * Pure helpers over the client-side `matches` array — no React, no Supabase,
 * no side effects. All date/time comparisons reuse the Fremont-time helpers
 * from `app/lib/matches.ts`.
 */
export type MyMatches = {
  /** Scheduled matches whose date/time has passed (most overdue first). */
  overdue: Match[];
  /** Scheduled matches not yet due (soonest first). */
  upcoming: Match[];
  /** Finalized matches (most recent first). */
  recent: Match[];
};

const inGroup = (match: Match, group: Group) => (match.league_group || 'Group B') === group;

const involvesTeam = (match: Match, teamId: string) => matchIncludesTeam(match.matchup, teamId);

const isScheduled = (match: Match) => match.status.toLowerCase() === 'scheduled';

const FINALIZED_STATUSES = new Set(['completed', 'retired', 'walkover']);

const isFinalized = (match: Match) => FINALIZED_STATUSES.has(match.status.toLowerCase());

const byDateTimeAsc = (a: Match, b: Match) =>
  a.match_date.localeCompare(b.match_date) || a.match_time.localeCompare(b.match_time);

const byDateTimeDesc = (a: Match, b: Match) => byDateTimeAsc(b, a);

/** Scheduled matches for the team whose date/time has passed in Fremont time. */
export function overdueMatchesForTeam(
  matches: Match[],
  group: Group,
  teamId: string,
  now: string = fremontNow()
): Match[] {
  if (!teamId) return [];
  return matches
    .filter(
      (match) =>
        inGroup(match, group) &&
        involvesTeam(match, teamId) &&
        isScheduled(match) &&
        matchDateTime(match) < now
    )
    .sort(byDateTimeAsc);
}

/** Scheduled matches for the team that are not yet due, soonest first. */
export function upcomingMatchesForTeam(
  matches: Match[],
  group: Group,
  teamId: string,
  now: string = fremontNow()
): Match[] {
  if (!teamId) return [];
  return matches
    .filter(
      (match) =>
        inGroup(match, group) &&
        involvesTeam(match, teamId) &&
        isScheduled(match) &&
        matchDateTime(match) >= now
    )
    .sort(byDateTimeAsc);
}

/** Finalized (Completed/Retired/Walkover) matches for the team, most recent first. */
export function recentCompletedMatchesForTeam(
  matches: Match[],
  group: Group,
  teamId: string
): Match[] {
  if (!teamId) return [];
  return matches
    .filter((match) => inGroup(match, group) && involvesTeam(match, teamId) && isFinalized(match))
    .sort(byDateTimeDesc);
}

/** Structured identity-scoped selection: overdue, upcoming, and recent matches. */
export function myMatches(
  matches: Match[],
  group: Group,
  teamId: string,
  now: string = fremontNow()
): MyMatches {
  return {
    overdue: overdueMatchesForTeam(matches, group, teamId, now),
    upcoming: upcomingMatchesForTeam(matches, group, teamId, now),
    recent: recentCompletedMatchesForTeam(matches, group, teamId),
  };
}
