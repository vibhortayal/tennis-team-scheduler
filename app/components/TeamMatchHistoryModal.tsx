'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Group, teamDisplay } from '../teams';
import { Match, dateText } from '../lib/matches';
import { teamMatchHistory, TeamMatchEntry } from '../lib/teamMatchHistory';

export const TEAM_HISTORY_EMPTY_COMPLETED = 'No completed matches yet.';
export const TEAM_HISTORY_EMPTY_UPCOMING = 'No upcoming matches scheduled.';

function outcomeBadge(entry: TeamMatchEntry): { label: string; className: string } {
  const status = entry.match.status.trim().toLowerCase();
  if (status === 'retired') return { label: 'Retired', className: 'team-history-outcome--neutral' };
  if (status === 'walkover')
    return { label: 'Walkover', className: 'team-history-outcome--neutral' };
  if (entry.outcome === 'win') return { label: 'Win', className: 'team-history-outcome--win' };
  if (entry.outcome === 'loss') return { label: 'Loss', className: 'team-history-outcome--loss' };
  return { label: 'Completed', className: 'team-history-outcome--neutral' };
}

function opponentLabel(entry: TeamMatchEntry, group: Group): string {
  return entry.opponentId ? teamDisplay(group, entry.opponentId) : 'Unknown opponent';
}

function CompletedRow({ entry, group }: { entry: TeamMatchEntry; group: Group }) {
  const { match } = entry;
  const badge = outcomeBadge(entry);
  return (
    <li className="team-history-match">
      <div className="team-history-main">
        <span className="team-history-date">{dateText(match.match_date)}</span>
        <span className="team-history-vs">vs {opponentLabel(entry, group)}</span>
        {match.result?.trim() && <span className="team-history-score">{match.result.trim()}</span>}
      </div>
      <div className="team-history-badges">
        <span className={`team-history-outcome ${badge.className}`}>{badge.label}</span>
        {entry.excluded && <span className="team-history-excluded">Excluded from standings</span>}
      </div>
    </li>
  );
}

function UpcomingRow({ entry, group }: { entry: TeamMatchEntry; group: Group }) {
  const { match } = entry;
  const time = match.match_time ? match.match_time.slice(0, 5) : '';
  const details = [time, match.court?.trim()].filter(Boolean).join(' · ');
  return (
    <li className="team-history-match">
      <div className="team-history-main">
        <span className="team-history-date">{dateText(match.match_date)}</span>
        <span className="team-history-vs">vs {opponentLabel(entry, group)}</span>
        {details && <span className="team-history-details">{details}</span>}
      </div>
      <div className="team-history-badges">
        <span className="team-history-status">{match.status}</span>
      </div>
    </li>
  );
}

export function TeamMatchHistoryModal({
  teamId,
  group,
  matches,
  onClose,
}: {
  teamId: string;
  group: Group;
  matches: Match[];
  onClose: () => void;
}) {
  const { completed, upcoming } = useMemo(
    () => teamMatchHistory(matches, group, teamId),
    [matches, group, teamId]
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape-to-close. Deliberately no backdrop-click close, matching the
  // existing modals in this app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Move focus into the dialog when it opens; the caller returns focus to
  // the team button when the dialog closes.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="modal">
      <div
        className="modal-card team-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-history-heading"
      >
        <h2 id="team-history-heading">Team {teamId} Match History</h2>
        <p className="team-history-sub">
          {teamDisplay(group, teamId)} · {group}
        </p>

        <section aria-labelledby="team-history-completed-heading">
          <h3 id="team-history-completed-heading">Completed matches</h3>
          {completed.length > 0 ? (
            <ul className="team-history-list">
              {completed.map((entry) => (
                <CompletedRow key={entry.match.id} entry={entry} group={group} />
              ))}
            </ul>
          ) : (
            <p className="empty">{TEAM_HISTORY_EMPTY_COMPLETED}</p>
          )}
        </section>

        <section aria-labelledby="team-history-upcoming-heading">
          <h3 id="team-history-upcoming-heading">Upcoming matches</h3>
          {upcoming.length > 0 ? (
            <ul className="team-history-list">
              {upcoming.map((entry) => (
                <UpcomingRow key={entry.match.id} entry={entry} group={group} />
              ))}
            </ul>
          ) : (
            <p className="empty">{TEAM_HISTORY_EMPTY_UPCOMING}</p>
          )}
        </section>

        <div className="actions">
          <button ref={closeRef} type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
