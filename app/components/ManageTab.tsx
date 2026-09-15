import { useState } from 'react';
import { Group } from '../teams';
import { Match, compareMatchDateTimeAsc, dateText, teamIds } from '../lib/matches';
import { groupStageBlockers, type Phase } from '../lib/knockout';
import { teamDisplay } from '../teams';

type ManageTabProps = {
  matches: Match[];
  onEdit: (match: Match) => void;
  onAddTeam: () => void;
  onManageTeams: () => void;
  phase: Phase;
  canReseed: boolean;
  onSeed: () => void;
  onReseed: () => void;
  onWalkover: (match: Match, winnerId: string) => void;
  onVoid: (match: Match) => void;
};

const PHASE_LABELS: Record<Phase, string> = {
  group: 'Group stage',
  quarterfinal: 'Quarterfinals',
  semifinal: 'Semifinals',
  final: 'Final',
  complete: 'Complete',
};

/**
 * Tournament management UI. Rendered only for the password-gated admin
 * identity: team administration, tournament phase controls (group-stage
 * completion, knockout seeding), plus a browser over every match in the
 * tournament (the admin can update any match).
 */
export function ManageTab({
  matches,
  onEdit,
  onAddTeam,
  onManageTeams,
  phase,
  canReseed,
  onSeed,
  onReseed,
  onWalkover,
  onVoid,
}: ManageTabProps) {
  const [statusFilter, setStatusFilter] = useState('All');

  const visible = matches
    .filter((match) => statusFilter === 'All' || match.status === statusFilter)
    .sort(compareMatchDateTimeAsc);

  const blockers = groupStageBlockers(matches);

  return (
    <>
      <section className="card">
        <h2>Tournament phase: {PHASE_LABELS[phase]}</h2>
        {phase === 'group' ? (
          blockers.length > 0 ? (
            <>
              <p>
                {blockers.length} group match{blockers.length === 1 ? '' : 'es'} still{' '}
                {blockers.length === 1 ? 'needs' : 'need'} a result before the group stage can be
                ended. Resolve each below:
              </p>
              <div>
                {blockers.map((match) => {
                  const matchGroup = (match.league_group || 'Group B') as Group;
                  const ids = teamIds(match, matchGroup);
                  const label =
                    ids.length === 2
                      ? `${teamDisplay(matchGroup, ids[0])} vs ${teamDisplay(matchGroup, ids[1])}`
                      : match.matchup;
                  return (
                    <div className="manage-team-row" key={match.id}>
                      <span>
                        {match.match_date ? dateText(match.match_date) : 'Unscheduled'} · {label} ·{' '}
                        <b>{match.status}</b>
                      </span>
                      <span className="actions">
                        {ids.length === 2 && (
                          <>
                            <button
                              type="button"
                              onClick={() => onWalkover(match, ids[0])}
                              title={`Award walkover to ${teamDisplay(matchGroup, ids[0])}`}
                            >
                              Walkover #{ids[0]}
                            </button>
                            <button
                              type="button"
                              onClick={() => onWalkover(match, ids[1])}
                              title={`Award walkover to ${teamDisplay(matchGroup, ids[1])}`}
                            >
                              Walkover #{ids[1]}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onVoid(match)}
                          title="Exclude this match"
                        >
                          Void match
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p>
                All group matches have results. Seed the quarterfinals when ready — standings will
                freeze and the knockout bracket goes live.
              </p>
              <div className="actions">
                <button type="button" onClick={onSeed}>
                  End group stage &amp; seed quarterfinals
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <p>The knockout bracket is live. Group standings are frozen.</p>
            {canReseed ? (
              <>
                <p>No quarterfinal has been decided yet, so the bracket can still be re-seeded.</p>
                <div className="actions">
                  <button type="button" onClick={onReseed}>
                    Re-seed quarterfinals
                  </button>
                </div>
              </>
            ) : (
              <p className="empty">
                Re-seeding is blocked: a quarterfinal has already been decided.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>Teams</h2>
        <p>Roster administration for the tournament.</p>
        <div className="actions">
          <button type="button" className="add-team-btn" onClick={onAddTeam}>
            + Add Team
          </button>
          <button type="button" className="manage-teams-btn" onClick={onManageTeams}>
            ⚙ Manage Teams
          </button>
        </div>
      </section>

      <section className="card">
        <h2>All matches ({visible.length})</h2>
        <div className="filters">
          {['All', 'Scheduled', 'Completed', 'Cancelled'].map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? 'active' : ''}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
        {visible.length ? (
          <div>
            {visible.map((match) => {
              const matchGroup = (match.league_group || 'Group B') as Group;
              const ids = teamIds(match, matchGroup);
              return (
                <div className="manage-team-row" key={match.id}>
                  <span>
                    {match.match_date ? dateText(match.match_date) : 'Unscheduled'} ·{' '}
                    {match.match_time ? `${match.match_time.slice(0, 5)} · ` : ''}
                    {ids.length === 2
                      ? `${teamDisplay(matchGroup, ids[0])} vs ${teamDisplay(matchGroup, ids[1])}`
                      : match.matchup}{' '}
                    · <b>{match.status}</b>
                    {match.result ? ` · ${match.result}` : ''}
                  </span>
                  <button type="button" onClick={() => onEdit(match)}>
                    Update
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty">No matches with this status.</p>
        )}
      </section>
    </>
  );
}
