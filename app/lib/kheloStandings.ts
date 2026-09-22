/**
 * Standings for the Innovation Tennis 2026 tournament, read live from the
 * KheloHQ tables (`matches`, `teams`) in the shared Supabase project.
 *
 * The tournament is public (tournaments.is_public = true), so the browser's
 * anon key can read it under the "matches/teams visibility read" RLS
 * policies. Standings are computed with the scheduler's own computeStandings,
 * which is behavior-identical to KheloHQ's engine (KheloHQ ports this file).
 * The one KheloHQ-side rule applied here before computing: pending/disputed
 * scores wait for confirmation and never count (countsTowardAggregates).
 */

import { headers } from './supabase';
import { computeStandings, type TeamStandingRow } from './scoring';
import type { Match } from './matches';
import type { Group, Team } from '../teams';

/** Innovation Tennis 2026 on KheloHQ. */
export const KHELO_TOURNAMENT_ID = 'c11aa58d-acad-47be-bf2c-bf65d8630375';

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

type KheloMatchRow = {
  id: string;
  matchup: string;
  match_date: string | null;
  match_time: string | null;
  court: string | null;
  status: string | null;
  result: string | null;
  group_name: string | null;
  stage: string | null;
  knockout_slot: string | null;
  excluded_from_standings: boolean | null;
  standings_override: Match['standings_override'];
  verification_status: string | null;
};

type KheloTeamRow = {
  team_number: string;
  player_names: string | null;
  group_name: string | null;
  status: string | null;
};

/**
 * KheloHQ's countsTowardAggregates (app/lib/scoring.ts in
 * tennis-tournament-manager): completed + confirmed counts; completed +
 * unverified/null counts (legacy, organizer-entered); pending and disputed
 * never count — they wait for confirmation.
 */
export function kheloMatchCounts(row: {
  status?: string | null;
  verification_status?: string | null;
}): boolean {
  if ((row.status ?? '').trim().toLowerCase() !== 'completed') return false;
  const v = (row.verification_status ?? 'unverified').trim().toLowerCase();
  return v === 'confirmed' || v === 'unverified';
}

/** Map one KheloHQ match row onto the scheduler's Match shape. */
export function mapKheloMatch(row: KheloMatchRow): Match {
  return {
    id: row.id,
    matchup: row.matchup,
    match_date: row.match_date ?? '',
    match_time: row.match_time ?? '',
    court: row.court ?? '',
    status: row.status ?? '',
    result: row.result,
    league_group: (row.group_name as Group) ?? undefined,
    excluded_from_standings: row.excluded_from_standings ?? false,
    standings_override: row.standings_override ?? null,
    stage: row.stage,
    knockout_slot: row.knockout_slot,
  };
}

/**
 * Build the scheduler roster for one group from KheloHQ teams.
 * Withdrawn teams are excluded, mirroring KheloHQ's groupStandings.
 */
export function kheloRosterForGroup(rows: KheloTeamRow[], group: Group): Team[] {
  return rows
    .filter((t) => t.group_name === group && (t.status ?? 'active') === 'active')
    .map((t) => [t.team_number, t.player_names ?? ''] as Team)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
}

async function fetchKhelo<T>(table: 'matches' | 'teams'): Promise<T[]> {
  if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  const select =
    table === 'matches'
      ? 'id,matchup,match_date,match_time,court,status,result,group_name,stage,knockout_slot,excluded_from_standings,standings_override,verification_status'
      : 'team_number,player_names,group_name,status';
  const url =
    `${baseUrl}/rest/v1/${table}?select=${select}` +
    `&tournament_id=eq.${KHELO_TOURNAMENT_ID}&limit=1000`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`KheloHQ ${table} fetch failed: ${response.status}`);
  }
  return (await response.json()) as T[];
}

export type KheloStandings = {
  standingsA: TeamStandingRow[];
  standingsB: TeamStandingRow[];
};

/** Fetch KheloHQ data and compute group standings for both groups. */
export async function fetchKheloStandings(): Promise<KheloStandings> {
  const [matchRows, teamRows] = await Promise.all([
    fetchKhelo<KheloMatchRow>('matches'),
    fetchKhelo<KheloTeamRow>('teams'),
  ]);
  // Pending/disputed scores wait for confirmation on KheloHQ; drop them here
  // so the numbers match KheloHQ exactly.
  const matches = matchRows.filter(kheloMatchCounts).map(mapKheloMatch);
  return {
    standingsA: computeStandings(matches, 'Group A', kheloRosterForGroup(teamRows, 'Group A')),
    standingsB: computeStandings(matches, 'Group B', kheloRosterForGroup(teamRows, 'Group B')),
  };
}
