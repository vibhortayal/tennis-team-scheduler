import { useEffect, useRef } from 'react';
import { Group, teamNames } from '../teams';
import { Match, dateText, teamIds } from '../lib/matches';
import {
  CompletedMatchEntry,
  UpcomingMatchEntry,
  getTeamMatchHistory,
} from '../lib/teamMatchHistory';

type TeamMatchHistoryModalProps = {
  isOpen: boolean;
  group: Group;
  teamId: string;
  allMatches: readonly Match[];
  roster?: Parameters<typeof teamIds>[2];
  onClose: () => void;
};

function opponentLabel(group: Group, opponentId: string | null): string {
  if (!opponentId) return 'Unknown opponent';
  return `#${opponentId} · ${teamNames(group, opponentId)}`;
}

function CompletedRow({ group, entry }: { group: Group; entry: CompletedMatchEntry }) {
  const { match, opponentId, outcome, isExcludedFromStandings } = entry;
  const isVoided = match.status.trim().toLowerCase() === 'voided';

  return (
    <li className={`history-row history-row--completed history-outcome-${outcome.toLowerCase()}`}>
      <div className="history-row-top">
        <span className="history-date">{dateText(match.match_date)}</span>
        <span className={`history-outcome-badge history-outcome-badge--${outcome.toLowerCase()}`}>
          {outcome}
        </span>
      </div>
      <div className="history-opponent">vs {opponentLabel(group, opponentId)}</div>
      <div className="history-result-row">
        <span className="history-result-text">{match.result?.trim() || match.status}</span>
        <span className="history-status-text">{match.status}</span>
      </div>
      {(isExcludedFromStandings || isVoided) && (
        <div className="history-flag" role="note">
          {isVoided
            ? 'Voided — removed from tournament records'
            : 'Excluded from standings'}
        </div>
      )}
    </li>
  );
}

function UpcomingRow({ group, entry }: { group: Group; entry: UpcomingMatchEntry }) {
  const { match, opponentId } = entry;
  return (
    <li className="history-row history-row--upcoming">
      <div className="history-row-top">
        <span className="history-date">{dateText(match.match_date)}</span>
        <span className="history-status-badge">{match.status}</span>
      </div>
      <div className="history-opponent">vs {opponentLabel(group, opponentId)}</div>
      <div className="history-meta">
        {match.match_time?.slice(0, 5)}
        {match.court ? ` · ${match.court}` : ''}
      </div>
    </li>
  );
}

export function TeamMatchHistoryModal({
  isOpen,
  group,
  teamId,
  allMatches,
  roster,
  onClose,
}: TeamMatchHistoryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { completed, upcoming } = getTeamMatchHistory(allMatches, group, teamId, roster);
  const teamName = teamNames(group, teamId);
  const headingId = `team-history-heading-${teamId}`;

  return (
    <div
      className="modal"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card team-history-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="team-history-header">
          <h2 id={headingId}>
            Team #{teamId} Match History
            {teamName && <span className="team-history-subtitle"> — {teamName}</span>}
          </h2>
          <button
            type="button"
            className="team-history-close"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label={`Close match history for Team #${teamId}`}
          >
            ×
          </button>
        </div>

        <section className="team-history-section" aria-labelledby={`${headingId}-completed`}>
          <h3 id={`${headingId}-completed`}>Completed matches</h3>
          {completed.length === 0 ? (
            <p className="history-empty">No completed matches yet.</p>
          ) : (
            <ul className="history-list">
              {completed.map((entry) => (
                <CompletedRow key={entry.match.id} group={group} entry={entry} />
              ))}
            </ul>
          )}
        </section>

        <section className="team-history-section" aria-labelledby={`${headingId}-upcoming`}>
          <h3 id={`${headingId}-upcoming`}>Upcoming matches</h3>
          {upcoming.length === 0 ? (
            <p className="history-empty">No upcoming matches scheduled.</p>
          ) : (
            <ul className="history-list">
              {upcoming.map((entry) => (
                <UpcomingRow key={entry.match.id} group={group} entry={entry} />
              ))}
            </ul>
          )}
        </section>

        <div className="actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
