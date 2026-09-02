export type Group = 'Group A' | 'Group B';
export type Team = readonly [string, string];
export type Identity = {
  name: string;
  teamId: string;
  group: Group;
  viewing?: boolean;
};
export const groups: Record<Group, readonly Team[]> = {
  'Group A': [
    ['2', 'Sudharssun, Kaushik'],
    ['5', 'Prathmesh, Tushar'],
    ['7', 'Akhil, Subrata'],
    ['9', 'Chaitanya, Prashant'],
    ['11', 'Niranjan, Naveen'],
    ['12', 'Dipen, Raja'],
  ],
  'Group B': [
    ['1', 'Dipesh, Vipin'],
    ['3', 'Gaurav, Anish'],
    ['4', 'Amit, Ananth'],
    ['6', 'Nissarg, Aniket'],
    ['8', 'Manikumar, Arindam'],
    ['10', 'Vibhor, Gourav'],
    ['13', 'Manoj, Srinivas'],
  ],
};
export const IDENTITY_KEY = 'ito-who-am-i';
export const allPlayers: Identity[] = (['Group A', 'Group B'] as Group[]).flatMap((group) =>
  groups[group].flatMap(([teamId, names]) =>
    names.split(',').map((name) => ({
      name: name.trim(),
      teamId,
      group,
    }))
  )
);

export const viewingIdentity: Identity = {
  name: 'Viewing only',
  teamId: '',
  group: 'Group B',
  viewing: true,
};

export const identityValue = (identity: Identity) =>
  identity.viewing ? 'viewing' : `${identity.group}:${identity.teamId}:${identity.name}`;

export const teamDisplay = (g: Group, id: string) => {
  const team = groups[g].find(([teamId]) => teamId === id);
  if (!team) return `#${id}`;
  const [first, second] = team[1].split(',').map((name) => name.trim());
  return `#${team[0]} · ${first} & ${second}`;
};

export const teamNames = (g: Group, id: string) => {
  const team = groups[g].find(([teamId]) => teamId === id);
  if (!team) return `Team #${id}`;
  const [first, second] = team[1].split(',').map((name) => name.trim());
  return `${first} & ${second}`;
};
