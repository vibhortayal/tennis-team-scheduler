import { Group, teamNames, teamDisplay } from '../teams';
import { Match, dateText, teamIds, matchesForTeam, currentDateInFremont } from '../lib/matches';

export function TeamLine({ group, id }: { group: Group; id: string }) {
  return (
    <div className="team-line">
      <span className="team-number">#{id}</span>
      <span className="team-names">{teamNames(group, id)}</span>
    </div>
  );
}

export function teamMatchLine(match: Match, group: Group, id: string) {
  const opponent = teamIds(match, group).find(teamId => teamId !== id);
  const vs = opponent ? teamDisplay(group, opponent) : 'Opponent';
  if (match.status.toLowerCase() === 'completed') {
    return `${dateText(match.match_date)} vs ${vs}${match.result ? ` · ${match.result}` : ''}`;
  }
  return `${dateText(match.match_date)} vs ${vs} · ${match.match_time.slice(0, 5)} · ${match.court}`;
}

export function TeamContext({ group, id, matches }: { group: Group; id: string; matches: Match[] }) {
  const today = currentDateInFremont();
  const teamMatches = matchesForTeam(matches, group, id);
  const last = teamMatches
    .filter(match => match.status.toLowerCase() === 'completed')
    .sort((a, b) => b.match_date.localeCompare(a.match_date) || b.match_time.localeCompare(a.match_time))[0];
  const next = teamMatches
    .filter(match => match.status.toLowerCase() === 'scheduled' && match.match_date >= today)
    .sort((a, b) => a.match_date.localeCompare(b.match_date) || a.match_time.localeCompare(b.match_time))[0];
  return (
    <div className="team-with-info">
      <TeamLine group={group} id={id} />
      <div className="info-inline">
        <p><b>Last match:</b> {last ? teamMatchLine(last, group, id) : 'None'}</p>
        <p><b>Next match:</b> {next ? teamMatchLine(next, group, id) : 'None'}</p>
      </div>
    </div>
  );
}

export function Matchup({ match, group }: { match: Match; group: Group }) {
  const ids = teamIds(match, group);
  if (ids.length !== 2) return <h3>{match.matchup}</h3>;
  return (
    <div className="matchup">
      <TeamLine group={group} id={ids[0]} />
      <span className="versus">vs</span>
      <TeamLine group={group} id={ids[1]} />
    </div>
  );
}

export function Section({
  title,
  list,
  edit,
  empty,
  group,
  selectedTeamId,
}: {
  title: string;
  list: Match[];
  edit: (m: Match) => void;
  empty: string;
  group: Group;
  selectedTeamId?: string | null;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {list.length ? (
        <div className="grid">
          {list.map(m => {
            const canUpdate = Boolean(selectedTeamId && teamIds(m, group).includes(selectedTeamId));
            return (
              <article className="card" key={m.id}>
                <small>{dateText(m.match_date)} · {m.match_time.slice(0, 5)} · <b>{m.status}</b></small>
                <Matchup match={m} group={group} />
                <p>{m.court}</p>
                {m.result && <p><b>{m.result}</b></p>}
                {m.cancellation_reason && <p>Reason: {m.cancellation_reason}</p>}
                <button
                  onClick={() => edit(m)}
                  disabled={!canUpdate}
                  title={canUpdate ? 'Update this match' : 'Only players on this match can update it'}
                  aria-label={canUpdate ? 'Update match' : 'Only players on this match can update it'}
                >
                  Update match
                </button>
                {!canUpdate && <p className="permission-note">Only players on this match can update it.</p>}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty">{empty}</p>
      )}
    </section>
  );
}
