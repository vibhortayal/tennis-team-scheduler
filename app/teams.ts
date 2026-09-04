export type Group = 'Group A' | 'Group B';
export type Team = readonly [string, string];
export type TeamStatus = 'active' | 'withdrawn';

export type TeamRecord = {
  id?: string;
  teamId: string;
  player1: string;
  player2: string;
  playerNames: string;
  group: Group;
  status: TeamStatus;
  createdAt?: string;
};

export type Identity = {
  name: string;
  teamId: string;
  group: Group;
  viewing?: boolean;
};

export const initialStaticTeams: readonly TeamRecord[] = [
  // Group A
  {
    teamId: '2',
    player1: 'Sudharssun',
    player2: 'Kaushik',
    playerNames: 'Sudharssun, Kaushik',
    group: 'Group A',
    status: 'active',
  },
  {
    teamId: '5',
    player1: 'Prathmesh',
    player2: 'Tushar',
    playerNames: 'Prathmesh, Tushar',
    group: 'Group A',
    status: 'active',
  },
  {
    teamId: '7',
    player1: 'Akhil',
    player2: 'Subrata',
    playerNames: 'Akhil, Subrata',
    group: 'Group A',
    status: 'active',
  },
  {
    teamId: '9',
    player1: 'Chaitanya',
    player2: 'Prashant',
    playerNames: 'Chaitanya, Prashant',
    group: 'Group A',
    status: 'active',
  },
  {
    teamId: '11',
    player1: 'Niranjan',
    player2: 'Naveen',
    playerNames: 'Niranjan, Naveen',
    group: 'Group A',
    status: 'active',
  },
  {
    teamId: '12',
    player1: 'Dipen',
    player2: 'Raja',
    playerNames: 'Dipen, Raja',
    group: 'Group A',
    status: 'active',
  },
  // Group B
  {
    teamId: '1',
    player1: 'Dipesh',
    player2: 'Vipin',
    playerNames: 'Dipesh, Vipin',
    group: 'Group B',
    status: 'active',
  },
  {
    teamId: '3',
    player1: 'Gaurav',
    player2: 'Anish',
    playerNames: 'Gaurav, Anish',
    group: 'Group B',
    status: 'active',
  },
  {
    teamId: '4',
    player1: 'Amit',
    player2: 'Ananth',
    playerNames: 'Amit, Ananth',
    group: 'Group B',
    status: 'active',
  },
  {
    teamId: '6',
    player1: 'Nisarg',
    player2: 'Aniket',
    playerNames: 'Nisarg, Aniket',
    group: 'Group B',
    status: 'active',
  },
  {
    teamId: '8',
    player1: 'Manikumar',
    player2: 'Arindam',
    playerNames: 'Manikumar, Arindam',
    group: 'Group B',
    status: 'active',
  },
  {
    teamId: '10',
    player1: 'Vibhor',
    player2: 'Gourav',
    playerNames: 'Vibhor, Gourav',
    group: 'Group B',
    status: 'active',
  },
  {
    teamId: '13',
    player1: 'Manoj',
    player2: 'Srinivas',
    playerNames: 'Manoj, Srinivas',
    group: 'Group B',
    status: 'active',
  },
];

export const initialGroups: Record<Group, readonly Team[]> = {
  'Group A': initialStaticTeams
    .filter((t) => t.group === 'Group A')
    .map((t) => [t.teamId, t.playerNames] as Team),
  'Group B': initialStaticTeams
    .filter((t) => t.group === 'Group B')
    .map((t) => [t.teamId, t.playerNames] as Team),
};

// Global active registry so helpers and existing consumers resolve up-to-date teams
export const groups: Record<Group, Team[]> = {
  'Group A': [...initialGroups['Group A']],
  'Group B': [...initialGroups['Group B']],
};

// Registry of all known teams (including withdrawn) for historical match display
export const allKnownTeams: Map<string, TeamRecord> = new Map(
  initialStaticTeams.map((t) => [t.teamId, t])
);

export const buildPlayersList = (rosterMap: Record<Group, readonly Team[]>): Identity[] =>
  (['Group A', 'Group B'] as Group[]).flatMap((group) =>
    (rosterMap[group] || []).flatMap(([teamId, names]) =>
      names.split(',').map((name) => ({
        name: name.trim(),
        teamId,
        group,
      }))
    )
  );

export const getActivePlayers = (teams: readonly TeamRecord[]): Identity[] =>
  teams
    .filter((t) => t.status === 'active')
    .flatMap((t) => {
      const p1 = t.player1?.trim();
      const p2 = t.player2?.trim();
      const names = p1 && p2 ? [p1, p2] : t.playerNames.split(',').map((n) => n.trim());
      return names.map((name) => ({
        name,
        teamId: t.teamId,
        group: t.group,
      }));
    });

export function updateTeamRegistry(records: readonly TeamRecord[]) {
  groups['Group A'] = [];
  groups['Group B'] = [];

  for (const record of records) {
    allKnownTeams.set(record.teamId, record);
    if (record.status !== 'withdrawn') {
      groups[record.group].push([record.teamId, record.playerNames]);
    }
  }

  allPlayers.length = 0;
  allPlayers.push(...buildPlayersList(groups));
}

export const IDENTITY_KEY = 'ito-who-am-i';

export const allPlayers: Identity[] = buildPlayersList(groups);

export const viewingIdentity: Identity = {
  name: 'Viewing only',
  teamId: '',
  group: 'Group B',
  viewing: true,
};

export const identityValue = (identity: Identity) =>
  identity.viewing ? 'viewing' : `${identity.group}:${identity.teamId}:${identity.name}`;

export const teamDisplay = (
  g: Group,
  id: string,
  customRoster?: Record<Group, readonly Team[]>
) => {
  const activeMap = customRoster || groups;
  let team = activeMap[g]?.find(([teamId]) => teamId === id);

  // Fallback to allKnownTeams if not in active group roster (e.g. withdrawn or cross-group)
  if (!team) {
    const known = allKnownTeams.get(id);
    if (known) {
      team = [known.teamId, known.playerNames];
    }
  }

  if (!team) return `#${id}`;
  const [first, second] = team[1].split(',').map((name) => name.trim());
  return second ? `#${team[0]} · ${first} & ${second}` : `#${team[0]} · ${first}`;
};

export const teamNames = (g: Group, id: string, customRoster?: Record<Group, readonly Team[]>) => {
  const activeMap = customRoster || groups;
  let team = activeMap[g]?.find(([teamId]) => teamId === id);

  if (!team) {
    const known = allKnownTeams.get(id);
    if (known) {
      team = [known.teamId, known.playerNames];
    }
  }

  if (!team) return `Team #${id}`;
  const [first, second] = team[1].split(',').map((name) => name.trim());
  return second ? `${first} & ${second}` : first;
};
