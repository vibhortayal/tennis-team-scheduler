import { Group, Team, TeamRecord } from '../teams';

export type NewTeamInput = {
  teamNumber: string;
  player1: string;
  player2: string;
  group: Group;
};

export type ValidatedTeamData = {
  teamNumber: string;
  player1: string;
  player2: string;
  playerNames: string;
  group: Group;
  status: 'active';
};

export type TeamValidationResult =
  | { ok: true; data: ValidatedTeamData }
  | { ok: false; error: string; field?: 'teamNumber' | 'player1' | 'player2' | 'group' };

/**
 * Validates new team creation input against existing teams in the league.
 * Pure function with no React or browser dependencies, fully unit testable.
 */
export function validateNewTeam(
  input: NewTeamInput,
  existingTeams: readonly TeamRecord[]
): TeamValidationResult {
  const teamNumber = input.teamNumber ? input.teamNumber.trim() : '';
  const player1 = input.player1 ? input.player1.trim() : '';
  const player2 = input.player2 ? input.player2.trim() : '';
  const group = input.group;

  // 1. Team number cannot be empty
  if (!teamNumber) {
    return { ok: false, error: 'Team number is required.', field: 'teamNumber' };
  }

  // 2. Team number must be unique across the entire league
  const isDuplicateNumber = existingTeams.some(
    (t) => t.teamId.trim().toLowerCase() === teamNumber.toLowerCase()
  );
  if (isDuplicateNumber) {
    return {
      ok: false,
      error: `Team #${teamNumber} already exists in the league. Team numbers must be unique.`,
      field: 'teamNumber',
    };
  }

  // 3. Both player names are required (and cannot be only whitespace)
  if (!player1) {
    return { ok: false, error: 'Player 1 name is required.', field: 'player1' };
  }
  if (!player2) {
    return { ok: false, error: 'Player 2 name is required.', field: 'player2' };
  }

  // 4. Player 1 and Player 2 cannot be the same person (case/trim-insensitive)
  if (player1.toLowerCase() === player2.toLowerCase()) {
    return {
      ok: false,
      error: 'Player 1 and Player 2 cannot be the same person.',
      field: 'player2',
    };
  }

  // 5. Valid league group check
  if (group !== 'Group A' && group !== 'Group B') {
    return { ok: false, error: 'Please select a valid league group.', field: 'group' };
  }

  // 6. Do not allow duplicate player-pair teams in the same group,
  // regardless of player order and case differences.
  const newPair = [player1.toLowerCase(), player2.toLowerCase()].sort();

  const isDuplicatePair = existingTeams.some((t) => {
    if (t.group !== group) return false;
    // Check using player1 and player2 properties if present
    const p1 = (t.player1 || '').trim().toLowerCase();
    const p2 = (t.player2 || '').trim().toLowerCase();
    if (p1 && p2) {
      const existingPair = [p1, p2].sort();
      return existingPair[0] === newPair[0] && existingPair[1] === newPair[1];
    }
    // Fallback: extract from playerNames string "P1, P2"
    const split = (t.playerNames || '').split(',').map((n) => n.trim().toLowerCase());
    if (split.length === 2) {
      const existingPair = split.sort();
      return existingPair[0] === newPair[0] && existingPair[1] === newPair[1];
    }
    return false;
  });

  if (isDuplicatePair) {
    return {
      ok: false,
      error: `A team with players "${player1}" and "${player2}" already exists in ${group}.`,
    };
  }

  return {
    ok: true,
    data: {
      teamNumber,
      player1,
      player2,
      playerNames: `${player1}, ${player2}`,
      group,
      status: 'active',
    },
  };
}

/**
 * Returns active teams for a group, excluding withdrawn teams.
 */
export function getActiveRoster(teams: readonly TeamRecord[], group: Group): Team[] {
  return teams
    .filter((t) => t.group === group && t.status === 'active')
    .map((t) => [t.teamId, t.playerNames] as Team);
}

/**
 * Returns all teams for a group, including withdrawn teams (for historical display).
 */
export function getAllRoster(teams: readonly TeamRecord[], group: Group): Team[] {
  return teams.filter((t) => t.group === group).map((t) => [t.teamId, t.playerNames] as Team);
}
