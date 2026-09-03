import { Group, groups, Identity } from '../teams';

export type Match = {
  id: string;
  matchup: string;
  match_date: string;
  match_time: string;
  court: string;
  status: string;
  result?: string | null;
  cancellation_reason?: string | null;
  league_group?: Group;
};

export type Draft = Omit<Match, 'id'>;

export type Suggestion = {
  opponentId: string;
  date: string;
  startsAt?: string;
  endsAt?: string;
  alternateCount?: number;
  missingPlayers?: string[];
  allPlayersReady?: boolean;
  yourGap: number;
  opponentGap: number;
  score: number;
};

export const blank = (g: Group): Draft => ({
  matchup: '',
  match_date: '',
  match_time: '10:00',
  court: 'Court 2',
  status: 'Scheduled',
  result: '',
  cancellation_reason: '',
  league_group: g,
});

export const dateText = (d: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${d}T12:00:00`));

export const fremontNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
};

export const matchDateTime = (m: Match) => `${m.match_date}T${m.match_time.slice(0, 5)}`;

export const currentDateInFremont = () => fremontNow().slice(0, 10);

const dayValue = (date: string) => new Date(`${date}T12:00:00`).getTime();

export const daysBetween = (from: string, to: string) =>
  Math.floor((dayValue(to) - dayValue(from)) / 86400000);

export const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isBlockingStatus = (status: string) => {
  const value = status.toLowerCase();
  return value === 'scheduled' || value === 'completed';
};

export const matchIncludesTeam = (matchup: string, teamId: string) => {
  const marker = `Team #${teamId}`;
  let from = 0;
  while (from <= matchup.length) {
    const index = matchup.indexOf(marker, from);
    if (index === -1) return false;
    const after = matchup[index + marker.length];
    if (!after || after < '0' || after > '9') return true;
    from = index + 1;
  }
  return false;
};

export const teamIds = (m: Match, g: Group) =>
  Array.from(m.matchup.matchAll(/Team #(\d+)/g), (match) => match[1]).filter((id) =>
    groups[g].some(([teamId]) => teamId === id)
  );

export const canUpdateMatch = (match: Match, identity: Identity) => {
  const matchGroup = (match.league_group || 'Group B') as Group;

  return (
    !identity.viewing &&
    Boolean(identity.teamId) &&
    teamIds(match, matchGroup).includes(identity.teamId)
  );
};

export const isSameFixture = (match: Match, group: Group, firstId: string, secondId: string) => {
  if ((match.league_group || 'Group B') !== group) return false;
  const ids = teamIds(match, group);
  return (
    (ids.includes(firstId) && ids.includes(secondId)) ||
    (matchIncludesTeam(match.matchup, firstId) && matchIncludesTeam(match.matchup, secondId))
  );
};

export const existingFixture = (
  allMatches: Match[],
  group: Group,
  firstId: string,
  secondId: string
) =>
  allMatches.find(
    (match) => isBlockingStatus(match.status) && isSameFixture(match, group, firstId, secondId)
  );

export const matchesForTeam = (allMatches: Match[], group: Group, teamId: string) =>
  allMatches.filter(
    (match) =>
      (match.league_group || 'Group B') === group &&
      isBlockingStatus(match.status) &&
      matchIncludesTeam(match.matchup, teamId)
  );

export const restGapAroundDate = (teamMatches: Match[], date: string) => {
  const previous = teamMatches
    .filter((match) => match.match_date < date)
    .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
  const nextMatch = teamMatches
    .filter((match) => match.match_date > date)
    .sort((a, b) => a.match_date.localeCompare(b.match_date))[0];
  const previousGap = previous ? daysBetween(previous.match_date, date) : 99;
  const nextGap = nextMatch ? daysBetween(date, nextMatch.match_date) : 99;
  return Math.min(previousGap, nextGap);
};
