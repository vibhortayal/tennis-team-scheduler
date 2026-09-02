/**
 * Pure scoring helpers - no React, no Supabase, no side effects.
 * All standings computation lives here so it can be tested in isolation.
 */

import { Group, groups } from '../teams';
import { Match, teamIds, matchIncludesTeam } from './matches';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetScore = {
  teamA: number;
  teamB: number;
};

/**
 * Structured per-set scores stored alongside the human-readable result string.
 * All three fields are optional - legacy matches only have `result` text.
 */
export type MatchScores = {
  set1?: SetScore;
  set2?: SetScore;
  set3?: SetScore;
};

export type ScoreEntryState = {
  set1A: string;
  set1B: string;
  set2A: string;
  set2B: string;
  set3A: string;
  set3B: string;
};

export const blankScoreEntry = (): ScoreEntryState => ({
  set1A: '',
  set1B: '',
  set2A: '',
  set2B: '',
  set3A: '',
  set3B: '',
});
// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ScoreValidationResult =
  | { ok: true; scores: MatchScores; result: string }
  | { ok: false; error: string };

type ParsedSet =
  | { ok: true; score: SetScore }
  | { ok: false; error: string };

const parseSet = (a: string, b: string): ParsedSet => {
  const na = Number(a.trim());
  const nb = Number(b.trim());
  if (!Number.isInteger(na) || na < 0 || !Number.isInteger(nb) || nb < 0) {
    return { ok: false, error: 'Set scores must be non-negative integers.' };
  }
  if (na === nb) {
    return { ok: false, error: `A set cannot end in a tie (${na}-${nb}).` };
  }
  return { ok: true, score: { teamA: na, teamB: nb } };
};

export function validateScores(entry: ScoreEntryState): ScoreValidationResult {
  // Set 1 required
  if (!entry.set1A.trim() || !entry.set1B.trim()) {
    return { ok: false, error: 'Set 1 scores are required.' };
  }
  const r1 = parseSet(entry.set1A, entry.set1B);
  if (r1.ok === false) {
    return { ok: false, error: `Set 1: ${r1.error}` };
  }

  // Set 2 required
  if (!entry.set2A.trim() || !entry.set2B.trim()) {
    return { ok: false, error: 'Set 2 scores are required.' };
  }
  const r2 = parseSet(entry.set2A, entry.set2B);
  if (r2.ok === false) {
    return { ok: false, error: `Set 2: ${r2.error}` };
  }

  // Determine whether the match is already decided after two sets.
  // If so, set 3 is irrelevant and may be left empty (or ignored entirely).
  const aWinsFirstTwo =
    (r1.score.teamA > r1.score.teamB ? 1 : 0) +
    (r2.score.teamA > r2.score.teamB ? 1 : 0);
  const bWinsFirstTwo =
    (r1.score.teamB > r1.score.teamA ? 1 : 0) +
    (r2.score.teamB > r2.score.teamA ? 1 : 0);
  const decidedInTwo = aWinsFirstTwo === 2 || bWinsFirstTwo === 2;

  let set3: SetScore | undefined;

  if (!decidedInTwo) {
    // Match split 1-1 after two sets, so a valid third set is required.
    const s3aBlank = !entry.set3A.trim();
    const s3bBlank = !entry.set3B.trim();
    if (s3aBlank !== s3bBlank) {
      return {
        ok: false,
        error: 'Set 3 must be either fully filled or fully blank.',
      };
    }
    if (s3aBlank) {
      return {
        ok: false,
        error: 'Set 3 scores are required when the match is split 1-1.',
      };
    }
    const r3 = parseSet(entry.set3A, entry.set3B);
    if (r3.ok === false) {
      return { ok: false, error: `Set 3: ${r3.error}` };
    }
    set3 = r3.score;
  } else if (entry.set3A.trim() && entry.set3B.trim()) {
    // Match already decided 2-0, but a third set was entered anyway.
    // Keep it only if it is a valid set; otherwise ignore silently.
    const r3 = parseSet(entry.set3A, entry.set3B);
    if (r3.ok === true) {
      set3 = r3.score;
    }
  }

  // Determine overall match winner across all recorded sets.
  const aWins = [
    r1.score.teamA > r1.score.teamB,
    r2.score.teamA > r2.score.teamB,
    set3 ? set3.teamA > set3.teamB : false,
  ].filter(Boolean).length;

  const bWins = [
    r1.score.teamB > r1.score.teamA,
    r2.score.teamB > r2.score.teamA,
    set3 ? set3.teamB > set3.teamA : false,
  ].filter(Boolean).length;

  if (aWins < 2 && bWins < 2) {
    return {
      ok: false,
      error: 'One team must win at least two sets.',
    };
  }

  // Build human-readable result string
  const parts = [
    `${r1.score.teamA}-${r1.score.teamB}`,
    `${r2.score.teamA}-${r2.score.teamB}`,
  ];
  if (set3) {
    parts.push(`${set3.teamA}-${set3.teamB}`);
  }
  const result = parts.join(', ');

  return {
    ok: true,
    scores: { set1: r1.score, set2: r2.score, set3 },
    result,
  };
}
/**
 * Parse a result string like "6-3, 6-4" or "Team #9 def. Team #11, 6-1, 6-4"
 * into structured SetScores. Returns null if unparseable.
 */
export function parseResultString(result: string): MatchScores | null {
  const parts = result.split(',').map(s => s.trim());
  if (parts.length < 2) return null;
  const parsed: SetScore[] = [];
  for (const part of parts) {
    const match = /(\d+)-(\d+)/.exec(part);
    if (!match) continue;
    parsed.push({ teamA: parseInt(match[1], 10), teamB: parseInt(match[2], 10) });
  }
  if (parsed.length < 2 || parsed.length > 3) return null;
  return {
    set1: parsed[0],
    set2: parsed[1],
    set3: parsed[2],
  };
}

/**
 * Populate a ScoreEntryState from an existing result string (for editing).
 */
export function scoreEntryFromResult(
  result: string | null | undefined,
): ScoreEntryState {
  if (!result) return blankScoreEntry();
  const parsed = parseResultString(result);
  if (!parsed) return blankScoreEntry();
  return {
    set1A: String(parsed.set1?.teamA ?? ''),
    set1B: String(parsed.set1?.teamB ?? ''),
    set2A: String(parsed.set2?.teamA ?? ''),
    set2B: String(parsed.set2?.teamB ?? ''),
    set3A: String(parsed.set3?.teamA ?? ''),
    set3B: String(parsed.set3?.teamB ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Standings computation
// ---------------------------------------------------------------------------

export type TeamStandingRow = {
  teamId: string;
  teamLabel: string;
  players: string;
  group: Group;
  totalMatches: number;
  matchesPlayed: number;
  matchesRemaining: number;
  matchesWon: number;
  matchesLost: number;
  totalPoints: number;
  netScoreRate: number;
  gamesWon: number;
  gamesLost: number;
  groupRank: number;
};

const TOTAL_MATCHES: Record<Group, number> = {
  'Group A': 5,
  'Group B': 6,
};

/**
 * Determine match winner from a structured result string.
 * Returns 'a' | 'b' | null.
 */
export function matchWinner(result: string): 'a' | 'b' | null {
  const scores = parseResultString(result);
  if (!scores || !scores.set1 || !scores.set2) return null;
  const sets = [scores.set1, scores.set2, scores.set3].filter(
    (s): s is SetScore => s !== undefined,
  );
  const aWins = sets.filter(s => s.teamA > s.teamB).length;
  const bWins = sets.filter(s => s.teamB > s.teamA).length;
  if (aWins >= 2) return 'a';
  if (bWins >= 2) return 'b';
  return null;
}
/**
 * Count total games won and lost by a team in a match.
 * teamA is the team that appears first in the matchup string.
 */
function gamesForTeam(
  result: string,
  isTeamA: boolean,
): { won: number; lost: number } {
  const scores = parseResultString(result);
  if (!scores) return { won: 0, lost: 0 };
  const sets = [scores.set1, scores.set2, scores.set3].filter(
    (s): s is SetScore => s !== undefined,
  );
  let won = 0;
  let lost = 0;
  for (const s of sets) {
    if (isTeamA) {
      won += s.teamA;
      lost += s.teamB;
    } else {
      won += s.teamB;
      lost += s.teamA;
    }
  }
  return { won, lost };
}

export function computeStandings(
  allMatches: Match[],
  group: Group,
): TeamStandingRow[] {
  const roster = groups[group];
  const total = TOTAL_MATCHES[group];

  // Only completed matches with parseable results
  const completedMatches = allMatches.filter(
    m =>
      (m.league_group || 'Group B') === group &&
      m.status === 'Completed' &&
      !!m.result?.trim() &&
      parseResultString(m.result) !== null,
  );

  const rows: TeamStandingRow[] = roster.map(([teamId, names]) => {
    const [first, second] = names.split(',').map(n => n.trim());
    const players = `${first} & ${second}`;
    const teamLabel = `#${teamId} - ${players}`;

    let matchesWon = 0;
    let matchesLost = 0;
    let gamesWon = 0;
    let gamesLost = 0;

    for (const m of completedMatches) {
      if (!matchIncludesTeam(m.matchup, teamId)) continue;

      const ids = teamIds(m, group);
      const isTeamA = ids[0] === teamId;
      const winner = matchWinner(m.result!);

      if (winner === 'a') {
        if (isTeamA) matchesWon++;
        else matchesLost++;
      } else if (winner === 'b') {
        if (!isTeamA) matchesWon++;
        else matchesLost++;
      } else {
        // Unparseable winner - skip for points but count games
        continue;
      }

      const games = gamesForTeam(m.result!, isTeamA);
      gamesWon += games.won;
      gamesLost += games.lost;
    }

    const matchesPlayed = matchesWon + matchesLost;
    const totalPoints = matchesWon * 2;
    const netScoreRate = gamesWon - gamesLost;

    return {
      teamId,
      teamLabel,
      players,
      group,
      totalMatches: total,
      matchesPlayed,
      matchesRemaining: total - matchesPlayed,
      matchesWon,
      matchesLost,
      totalPoints,
      netScoreRate,
      gamesWon,
      gamesLost,
      groupRank: 0,
    };
  });

  // Sort by ranking rules
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.netScoreRate !== a.netScoreRate)
      return b.netScoreRate - a.netScoreRate;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    return Number(a.teamId) - Number(b.teamId);
  });

  rows.forEach((row, i) => {
    row.groupRank = i + 1;
  });

  return rows;
}
