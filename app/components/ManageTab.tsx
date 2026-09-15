import { useState } from 'react';
import { Group } from '../teams';
import { Match, dateText, teamIds } from '../lib/matches';
import { teamDisplay } from '../teams';

type ManageTabProps = {
  matches: Match[];
  onEdit: (match: Match) => void;
  onAddTeam: () => void;
  onManageTeams: () => void;
};

/**
 * Tournament management UI. Rendered only for the password-gated admin
 * identity: team administration plus a browser over every match in the
 * tournament (the admin can update any match).
 */
export function ManageTab({ matches, onEdit, onAddTeam, onManageTeams }: ManageTabProps) {
  const [statusFilter, setStatusFilter] = useState('All');

  const visible = matches
    .filter((match) => statusFilter === 'All' || match.status === statusFilter)
    .sort(
      (a, b) => a.match_date.localeCompare(b.match_date) || a.match_time.localeCompare(b.match_time)
    );

  return (
    <>
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
                    {match.match_time.slice(0, 5)} ·{' '}
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
