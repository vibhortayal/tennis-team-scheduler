import { Identity, teamDisplay } from '../teams';
import { Match, dateText } from '../lib/matches';
import { myMatches } from '../lib/myMatches';
import { Matchup } from './MatchCard';

type MyMatchesPanelProps = {
  matches: Match[];
  identity: Identity;
  onEdit: (match: Match) => void;
};

/**
 * Pinned, identity-scoped "My Matches" panel.
 *
 * Always scoped to `identity.group` + `identity.teamId` — never to the
 * dashboard's Group A/B tab or team-scope dropdown selection. Renders nothing
 * for viewing-only identities.
 */
export function MyMatchesPanel({ matches, identity, onEdit }: MyMatchesPanelProps) {
  if (identity.viewing || !identity.teamId) return null;

  const group = identity.group;
  const teamLabel = `Team #${identity.teamId}`;
  const { overdue, upcoming, recent } = myMatches(matches, group, identity.teamId);
  const isEmpty = overdue.length === 0 && upcoming.length === 0 && recent.length === 0;

  return (
    <section className="my-matches" aria-label={`My matches for ${teamLabel}`}>
      <div className="eyebrow">PERSONALIZED</div>
      <h2 className="my-matches-heading">My Matches</h2>
      <p className="my-matches-sub">{teamDisplay(group, identity.teamId)}</p>

      {isEmpty ? (
        <p className="my-matches-empty">No matches yet for {teamLabel}.</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <div className="my-matches-group">
              <h3 className="my-matches-group-title">Action needed</h3>
              <div className="grid">
                {overdue.map((match) => (
                  <article className="card my-matches-overdue-card" key={match.id}>
                    <div className="my-matches-chip">Action needed</div>
                    <small>
                      {dateText(match.match_date)} · {match.match_time.slice(0, 5)} ·{' '}
                      <b>Scheduled</b>
                    </small>
                    <Matchup match={match} group={group} />
                    <p>{match.court}</p>
                    <button onClick={() => onEdit(match)} aria-label="Update match details">
                      Update match details
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="my-matches-group">
              <h3 className="my-matches-group-title">Up next</h3>
              <div className="grid">
                {upcoming.map((match) => (
                  <article className="card" key={match.id}>
                    <small>
                      {dateText(match.match_date)} · {match.match_time.slice(0, 5)} ·{' '}
                      <b>{match.status}</b>
                    </small>
                    <Matchup match={match} group={group} />
                    <p>{match.court}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="my-matches-group">
              <h3 className="my-matches-group-title">Recent results</h3>
              <div className="grid">
                {recent.map((match) => (
                  <article className="card" key={match.id}>
                    <small>
                      {dateText(match.match_date)} · {match.match_time.slice(0, 5)} ·{' '}
                      <b>{match.status}</b>
                    </small>
                    <Matchup match={match} group={group} />
                    {match.result && (
                      <p>
                        <b>{match.result}</b>
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
