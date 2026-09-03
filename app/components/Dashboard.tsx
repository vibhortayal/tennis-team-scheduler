import { Group, Identity, groups, teamDisplay } from '../teams';
import { Match, dateText, canUpdateMatch, teamIds } from '../lib/matches';
import { Matchup, Section } from './MatchCard';

type DashboardProps = {
  nextMatches: Match[];
  nextMatchDate: string;
  overdue: Match[];
  upcoming: Match[];
  completed: Match[];
  cancelled: Match[];
  hasTodayMatches: boolean;
  group: Group;
  filter: string;
  team: string;
  identity: Identity;
  onGroupChange: (group: Group) => void;
  onSchedule: () => void;
  onFilterChange: (filter: string) => void;
  onTeamChange: (team: string) => void;
  onEdit: (match: Match) => void;
};

export function Dashboard({
  nextMatches,
  nextMatchDate,
  overdue,
  upcoming,
  completed,
  cancelled,
  hasTodayMatches,
  group,
  filter,
  team,
  identity,
  onGroupChange,
  onSchedule,
  onFilterChange,
  onTeamChange,
  onEdit,
}: DashboardProps) {
  const roster = groups[group];
  const filteredNextMatches = nextMatches.filter(
    (match) =>
      (filter === 'All' || match.status === filter) &&
      (!team || teamIds(match, group).includes(team))
  );
  const showNextMatches = filter === 'All' || filter === 'Scheduled';

  return (
    <>
      {showNextMatches && filteredNextMatches.length > 0 ? (
        <section className="hero next-matches">
          <div className="wide-hero">
            <div className="eyebrow">NEXT MATCH · {dateText(nextMatchDate)}</div>

            <div className="grid">
              {filteredNextMatches.map((match) => {
                const matchGroup = (match.league_group || 'Group B') as Group;

                return (
                  <article className="card" key={match.id}>
                    <small>
                      {matchGroup.toUpperCase()} · {match.match_time.slice(0, 5)}
                    </small>

                    <Matchup match={match} group={matchGroup} />

                    <p>{match.court}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="hero">
          <div>
            <div className="eyebrow">NEXT MATCH</div>
            <h1>No upcoming matches scheduled.</h1>
            <p>Schedule the next match to get started.</p>
          </div>

          <div className="badge">UPCOMING</div>
        </section>
      )}

      <div className="tabs">
        {(['Group A', 'Group B'] as Group[]).map((nextGroup) => (
          <button
            className={group === nextGroup ? 'active' : ''}
            onClick={() => onGroupChange(nextGroup)}
            key={nextGroup}
          >
            {nextGroup} · {groups[nextGroup].length} teams
          </button>
        ))}
      </div>

      <button className="group-schedule" onClick={onSchedule}>
        Schedule match
      </button>

      <div className="filters">
        {['All', 'Scheduled', 'Completed', 'Cancelled'].map((status) => (
          <button
            className={filter === status ? 'active' : ''}
            onClick={() => onFilterChange(status)}
            key={status}
          >
            {status}
          </button>
        ))}

        <select value={team} onChange={(event) => onTeamChange(event.target.value)}>
          <option value="">All {group} teams</option>

          {roster.map(([id]) => (
            <option value={id} key={id}>
              {teamDisplay(group, id)}
            </option>
          ))}
        </select>
      </div>

      {overdue.length > 0 && (
        <section className="overdue-section">
          <h2 className="overdue-heading">
            Action required — {overdue.length} past match
            {overdue.length === 1 ? '' : 'es'}
          </h2>

          <p className="overdue-copy">
            These scheduled match times have passed in Fremont. Update each match as completed with
            a result, or cancel it with a reason.
          </p>

          <div className="grid">
            {overdue.map((match) => {
              const canUpdate = canUpdateMatch(match, identity);

              return (
                <article className="card overdue-card" key={match.id}>
                  <div className="overdue-badge">UPDATE REQUIRED</div>

                  <small>
                    {dateText(match.match_date)} · {match.match_time.slice(0, 5)} · <b>Scheduled</b>
                  </small>

                  <Matchup match={match} group={group} />

                  <p>{match.court}</p>

                  <button
                    onClick={() => onEdit(match)}
                    disabled={!canUpdate}
                    title={
                      canUpdate
                        ? 'Update match details'
                        : 'Only players on this match can update it'
                    }
                    aria-label={
                      canUpdate
                        ? 'Update match details'
                        : 'Only players on this match can update it'
                    }
                  >
                    Update match details
                  </button>

                  {!canUpdate && (
                    <p className="permission-note">Only players on this match can update it.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <Section
        title={hasTodayMatches ? "Today's matches" : 'Upcoming matches'}
        list={upcoming}
        edit={onEdit}
        empty="No upcoming matches."
        group={group}
        selectedIdentity={identity}
      />

      <Section
        title="Recent results"
        list={completed}
        edit={onEdit}
        empty="No completed matches."
        group={group}
        selectedIdentity={identity}
      />

      <Section
        title="Cancelled matches"
        list={cancelled}
        edit={onEdit}
        empty="No cancelled matches."
        group={group}
        selectedIdentity={identity}
      />
    </>
  );
}
