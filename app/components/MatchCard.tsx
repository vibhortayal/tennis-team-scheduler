import { Group, Identity, teamNames, teamDisplay } from '../teams';
import {
  Match,
  canUpdateMatch,
  compareMatchDateTimeAsc,
  compareMatchDateTimeDesc,
  dateText,
  teamIds,
  matchesForTeam,
  currentDateInFremont,
  isMatchOverdue,
} from '../lib/matches';
import { matchWinner } from '../lib/scoring';

export function TeamLine({
  group,
  id,
  winner = false,
}: {
  group: Group;
  id: string;
  winner?: boolean;
}) {
  return (
    <div className={winner ? 'team-line winner' : 'team-line'}>
      <span className="team-number">#{id}</span>
      <span className="team-names">{teamNames(group, id)}</span>
      {winner && (
        <span className="winner-badge" aria-label="Winner" title="Winner">
          ★ Winner
        </span>
      )}
    </div>
  );
}

export function teamMatchLine(match: Match, group: Group, id: string) {
  const opponent = teamIds(match, group).find((teamId) => teamId !== id);
  const vs = opponent ? teamDisplay(group, opponent) : 'Opponent';
  if (match.status.toLowerCase() === 'completed') {
    return `${dateText(match.match_date)} vs ${vs}${match.result ? ` · ${match.result}` : ''}`;
  }
  return `${dateText(match.match_date)} vs ${vs} · ${match.match_time ? match.match_time.slice(0, 5) : 'Time TBD'} · ${match.court}`;
}

export function TeamContext({
  group,
  id,
  matches,
}: {
  group: Group;
  id: string;
  matches: Match[];
}) {
  const today = currentDateInFremont();
  const teamMatches = matchesForTeam(matches, group, id);
  const last = teamMatches
    .filter((match) => match.status.toLowerCase() === 'completed')
    .sort(compareMatchDateTimeDesc)[0];
  const next = teamMatches
    .filter((match) => match.status.toLowerCase() === 'scheduled' && match.match_date >= today)
    .sort(compareMatchDateTimeAsc)[0];
  return (
    <div className="team-with-info">
      <TeamLine group={group} id={id} />
      <div className="info-inline">
        <p>
          <b>Last match:</b> {last ? teamMatchLine(last, group, id) : 'None'}
        </p>
        <p>
          <b>Next match:</b> {next ? teamMatchLine(next, group, id) : 'None'}
        </p>
      </div>
    </div>
  );
}

export function Matchup({ match, group }: { match: Match; group: Group }) {
  const ids = teamIds(match, group);
  if (ids.length !== 2) return <h3>{match.matchup}</h3>;
  const isCompleted = match.status.toLowerCase() === 'completed';
  const winner = isCompleted && match.result ? matchWinner(match.result) : null;
  return (
    <div className="matchup">
      <TeamLine group={group} id={ids[0]} winner={winner === 'a'} />
      <span className="versus">vs</span>
      <TeamLine group={group} id={ids[1]} winner={winner === 'b'} />
    </div>
  );
}
export function Section({
  title,
  list,
  edit,
  empty,
  group,
  selectedIdentity,
}: {
  title: string;
  list: Match[];
  edit: (m: Match) => void;
  empty: string;
  group: Group;
  selectedIdentity?: Identity | null;
}) {
  const today = currentDateInFremont();
  return (
    <section>
      <h2>{title}</h2>
      {list.length ? (
        <div className="grid">
          {list.map((m) => {
            const canUpdate = Boolean(selectedIdentity && canUpdateMatch(m, selectedIdentity));
            return (
              <article className="card" key={m.id}>
                <small>
                  {dateText(m.match_date)} · {m.match_time ? m.match_time.slice(0, 5) : 'Time TBD'}{' '}
                  · <b>{m.status}</b>
                  {isMatchOverdue(m, today) && canUpdate && (
                    <span className="update-needed-badge">Update needed</span>
                  )}
                </small>
                <Matchup match={m} group={group} />
                <p>{m.court}</p>
                {m.result && (
                  <p>
                    <b>{m.result}</b>
                  </p>
                )}
                {m.cancellation_reason && <p>Reason: {m.cancellation_reason}</p>}
                <button
                  onClick={() => edit(m)}
                  disabled={!canUpdate}
                  title={
                    canUpdate ? 'Update this match' : 'Only players on this match can update it'
                  }
                  aria-label={
                    canUpdate ? 'Update match' : 'Only players on this match can update it'
                  }
                >
                  Update match
                </button>
                {!canUpdate && (
                  <p className="permission-note">Only players on this match can update it.</p>
                )}
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
