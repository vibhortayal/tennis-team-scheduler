import { useState } from 'react';
import { Group, Identity, Team, groups, teamDisplay } from '../teams';
import {
  Match,
  dateText,
  canUpdateMatch,
  currentDateInFremont,
  featuredDayMatches,
  matchesForIdentityTeam,
  teamIds,
} from '../lib/matches';
import { nextKnockoutFixture, matchStage, type Phase } from '../lib/knockout';
import { TeamStandingRow } from '../lib/scoring';
import { Matchup, Section } from './MatchCard';
import { BracketView } from './Bracket';
import { shouldShowActionRequired } from '../lib/teamScope';

type DashboardProps = {
  matches: Match[];
  overdue: Match[];
  upcoming: Match[];
  completed: Match[];
  cancelled: Match[];
  group: Group;
  filter: string;
  team: string;
  identity: Identity;
  roster?: readonly Team[];
  rosters?: Record<Group, readonly Team[]>;
  onGroupChange: (group: Group) => void;
  onFilterChange: (filter: string) => void;
  onTeamChange: (team: string) => void;
  onEdit: (match: Match) => void;
  onAddTeam?: () => void;
  onManageTeams?: () => void;
  /** Current tournament phase; drives the knockout hero and bracket. */
  phase: Phase;
  /** All knockout-stage matches (used for the next-fixture hero). */
  knockoutMatches: Match[];
  /** Frozen group standings, for the eliminated-team hero rank line. */
  standingsA: TeamStandingRow[];
  standingsB: TeamStandingRow[];
};

export function Dashboard({
  matches,
  overdue,
  upcoming,
  completed,
  cancelled,
  group,
  filter,
  team,
  identity,
  roster,
  rosters,
  onGroupChange,
  onFilterChange,
  onTeamChange,
  onEdit,
  onAddTeam,
  onManageTeams,
  phase,
  knockoutMatches,
  standingsA,
  standingsB,
}: DashboardProps) {
  const currentRoster = roster || groups[group];
  const currentRosters = rosters || groups;
  const showActionRequired = shouldShowActionRequired(identity, team, overdue.length);
  // Past-due matches stay visible as Scheduled for everyone else; they get the
  // urgent treatment only when the signed-in user views their own team.
  const upcomingWithOverdue = showActionRequired ? upcoming : [...overdue, ...upcoming];
  const filteredUpcoming = upcomingWithOverdue.filter(
    (match) =>
      (filter === 'All' || match.status === filter) &&
      (!team || teamIds(match, group).includes(team))
  );
  const today = currentDateInFremont();
  // Hero scope toggle: "All matches" is tournament-wide; "My matches" shows
  // the signed-in identity's team. Only offered when signed in with a team.
  const [heroScope, setHeroScope] = useState<'all' | 'mine'>('all');
  const canShowMyMatches = !identity.viewing && identity.teamId !== '';
  const heroPool =
    heroScope === 'mine' && canShowMyMatches ? matchesForIdentityTeam(matches, identity) : matches;
  // Featured card shows every scheduled match on the featured day (today, or
  // the date of the next scheduled match), regardless of group tab or
  // team-dropdown selection.
  const featuredMatches = featuredDayMatches(heroPool, today);
  const featuredDate = featuredMatches[0]?.match_date ?? null;
  const showNextMatches = filter === 'All' || filter === 'Scheduled';
  const plural = featuredMatches.length === 1 ? '' : 'ES';
  const eyebrowLabel =
    heroScope === 'mine'
      ? `MY MATCH${plural}`
      : `${featuredDate === today ? "TODAY'S MATCH" : 'NEXT MATCH'}${plural}`;
  const heroToggle = canShowMyMatches ? (
    <div className="hero-toggle" role="group" aria-label="Choose which matches to feature">
      <button
        type="button"
        className={heroScope === 'all' ? 'active' : ''}
        onClick={() => setHeroScope('all')}
      >
        All matches
      </button>
      <button
        type="button"
        className={heroScope === 'mine' ? 'active' : ''}
        onClick={() => setHeroScope('mine')}
      >
        My matches
      </button>
    </div>
  ) : null;

  // Knockout-phase hero for signed-in players: their next fixture if they are
  // still alive, otherwise an eliminated/spectator message with their final
  // group rank. Admins and viewers keep the tournament-wide hero.
  const isKnockoutPlayer =
    phase !== 'group' && !identity.viewing && !identity.admin && identity.teamId !== '';
  const knockoutNext = isKnockoutPlayer
    ? nextKnockoutFixture(knockoutMatches, identity.teamId)
    : null;
  const finalRank =
    isKnockoutPlayer && !knockoutNext
      ? [
          { group: 'Group A' as Group, rows: standingsA },
          { group: 'Group B' as Group, rows: standingsB },
        ]
          .map(({ group: g, rows }) => {
            const row = rows.find((r) => r.teamId === identity.teamId);
            return row ? { group: g, rank: row.groupRank } : null;
          })
          .find(Boolean)
      : null;

  return (
    <>
      {knockoutNext ? (
        <section className="hero next-matches">
          <div className="wide-hero">
            <div className="eyebrow">YOUR {matchStage(knockoutNext).toUpperCase()}</div>

            <div className="grid">
              <article className="card" key={knockoutNext.id}>
                <small>
                  KNOCKOUT ·{' '}
                  {knockoutNext.match_date
                    ? `${dateText(knockoutNext.match_date)} · ${knockoutNext.match_time.slice(0, 5)}`
                    : 'Date TBD'}
                </small>

                <Matchup match={knockoutNext} group={identity.group} />

                <p>
                  {knockoutNext.court || 'Court TBD'} · <b>{knockoutNext.status}</b>
                </p>

                {canUpdateMatch(knockoutNext, identity) && (
                  <button type="button" onClick={() => onEdit(knockoutNext)}>
                    {knockoutNext.match_date ? 'Update match' : 'Schedule match'}
                  </button>
                )}
              </article>
            </div>
          </div>
        </section>
      ) : isKnockoutPlayer ? (
        <section className="hero">
          <div>
            <div className="eyebrow">TOURNAMENT</div>

            <h1>Your tournament has ended.</h1>

            <p>
              {finalRank ? `You finished #${finalRank.rank} in ${finalRank.group}. ` : ''}
              Follow the knockout bracket below.
            </p>
          </div>

          <div className="badge">SPECTATOR</div>
        </section>
      ) : showNextMatches && featuredDate ? (
        <section className="hero next-matches">
          <div className="wide-hero">
            <div className="eyebrow">
              {eyebrowLabel} · {dateText(featuredDate)}
            </div>

            {heroToggle}

            <div className="grid">
              {featuredMatches.map((match) => {
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
            <div className="eyebrow">{heroScope === 'mine' ? 'MY MATCHES' : 'NEXT MATCH'}</div>

            {heroToggle}

            <h1>
              {heroScope === 'mine'
                ? 'No upcoming matches for your team.'
                : 'No upcoming matches scheduled.'}
            </h1>

            <p>
              {heroScope === 'mine'
                ? 'Check back after the next round is scheduled.'
                : 'Schedule the next match to get started.'}
            </p>
          </div>

          <div className="badge">UPCOMING</div>
        </section>
      )}

      {phase !== 'group' && (
        <BracketView matches={knockoutMatches} identity={identity} onEdit={onEdit} />
      )}

      <div className="tabs">
        {(['Group A', 'Group B'] as Group[]).map((nextGroup) => (
          <button
            className={group === nextGroup ? 'active' : ''}
            onClick={() => onGroupChange(nextGroup)}
            key={nextGroup}
          >
            {nextGroup} · {currentRosters[nextGroup].length} teams
          </button>
        ))}
      </div>

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

          {currentRoster.map(([id]) => (
            <option value={id} key={id}>
              {teamDisplay(group, id)}
            </option>
          ))}
        </select>

        {onAddTeam && (
          <button
            type="button"
            className="add-team-filter-btn"
            onClick={onAddTeam}
            title="Add a new team to the league"
          >
            + Add Team
          </button>
        )}

        {onManageTeams && (
          <button
            type="button"
            className="manage-teams-filter-btn"
            onClick={onManageTeams}
            title="Withdraw or reactivate teams"
          >
            ⚙ Manage Teams
          </button>
        )}
      </div>

      {showActionRequired && (
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
        title="Upcoming matches"
        list={filteredUpcoming}
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
