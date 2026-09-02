import { FormEvent, useState, useEffect } from 'react';
import { Group, Team, allPlayers, identityValue, teamDisplay, teamNames } from '../teams';
import { Draft } from '../lib/matches';
import {
  ScoreEntryState,
  blankScoreEntry,
  scoreEntryFromResult,
  validateScores,
} from '../lib/scoring';
import { ScoreEntry } from './ScoreEntry';

const sortedPlayers = [...allPlayers].sort((a, b) => a.name.localeCompare(b.name));

export function IdentityPrompt({
  value,
  onValue,
  onCancel,
  onContinue,
}: {
  value: string;
  onValue: (v: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-heading"
      >
        <h2 id="identity-heading">Welcome! Select your player</h2>
        <p>
          Choose the player you&apos;re scheduling for. You can switch players anytime from the
          top-right menu.
        </p>
        <label className="field">
          Player
          <select value={value} onChange={(event) => onValue(event.target.value)}>
            <option value="">Select a player</option>
            {sortedPlayers.map((player) => (
              <option key={identityValue(player)} value={identityValue(player)}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button className="secondary" type="button" onClick={onCancel}>
            Not now
          </button>
          <button type="button" disabled={!value} onClick={onContinue}>
            Continue to scheduling
          </button>
        </div>
      </div>
    </div>
  );
}
type MatchModalProps = {
  group: Group;
  roster: readonly Team[];
  editing: boolean;
  first: string;
  second: string;
  draft: Draft;
  note: string;
  onFirst: (v: string) => void;
  onSecond: (v: string) => void;
  onDraft: (d: Draft) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent, scores: ScoreEntryState) => void;
};

export function MatchModal({
  group,
  roster,
  editing,
  first,
  second,
  draft,
  note,
  onFirst,
  onSecond,
  onDraft,
  onClose,
  onSubmit,
}: MatchModalProps) {
  const [scoreEntry, setScoreEntry] = useState<ScoreEntryState>(blankScoreEntry());
  const [scoreError, setScoreError] = useState('');

  // When the modal opens for editing, pre-populate score fields from existing result
  useEffect(() => {
    if (draft.status === 'Completed' && draft.result) {
      setScoreEntry(scoreEntryFromResult(draft.result));
    } else {
      setScoreEntry(blankScoreEntry());
    }
    setScoreError('');
  }, [draft.status, draft.result]);

  // When status changes away from Completed, clear score fields
  const handleStatusChange = (nextStatus: string) => {
    onDraft({ ...draft, status: nextStatus });
    if (nextStatus !== 'Completed') {
      setScoreEntry(blankScoreEntry());
      setScoreError('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.status === 'Completed') {
      const validation = validateScores(scoreEntry);
      if (validation.ok === false) {
        setScoreError(validation.error);
        return;
      }
      // Write the result string into draft before parent save handler runs
      onDraft({ ...draft, result: validation.result });
      setScoreError('');
      onSubmit(e, scoreEntry);
    } else {
      onSubmit(e, scoreEntry);
    }
  };

  // Labels shown next to score inputs
  const firstLabel = roster.find(([id]) => id === first)
    ? `#${first} ${teamNames(group, first)}`
    : `#${first}`;
  const secondLabel = roster.find(([id]) => id === second)
    ? `#${second} ${teamNames(group, second)}`
    : `#${second}`;
  return (
    <div className="modal">
      <form onSubmit={handleSubmit} className="modal-card">
        <h2>
          {editing ? 'Update' : 'Schedule'} {group} match
        </h2>
        {note && <p className="notice">{note}</p>}
        <div className="fields">
          <label className="field">
            First team
            <select value={first} onChange={(e) => onFirst(e.target.value)}>
              {roster
                .filter(([id]) => id !== second)
                .map(([id]) => (
                  <option value={id} key={id}>
                    {teamDisplay(group, id)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Opponent
            <select value={second} onChange={(e) => onSecond(e.target.value)}>
              {roster
                .filter(([id]) => id !== first)
                .map(([id]) => (
                  <option value={id} key={id}>
                    {teamDisplay(group, id)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Date
            <input
              type="date"
              value={draft.match_date}
              onChange={(e) => onDraft({ ...draft, match_date: e.target.value })}
            />
          </label>
          <label className="field">
            Time
            <input
              type="time"
              value={draft.match_time}
              onChange={(e) => onDraft({ ...draft, match_time: e.target.value })}
            />
          </label>
          <label className="field">
            Court
            <input
              value={draft.court}
              onChange={(e) => onDraft({ ...draft, court: e.target.value })}
            />
          </label>
          <label className="field">
            Status
            <select value={draft.status} onChange={(e) => handleStatusChange(e.target.value)}>
              {['Scheduled', 'Completed', 'Cancelled'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          {draft.status === 'Completed' && (
            <ScoreEntry
              teamALabel={firstLabel}
              teamBLabel={secondLabel}
              entry={scoreEntry}
              error={scoreError}
              onChange={(next) => {
                setScoreEntry(next);
                setScoreError('');
              }}
            />
          )}

          {draft.status === 'Cancelled' && (
            <label className="field wide">
              Cancellation reason
              <textarea
                value={draft.cancellation_reason || ''}
                onChange={(e) => onDraft({ ...draft, cancellation_reason: e.target.value })}
              />
            </label>
          )}
        </div>
        <div className="actions">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button>Save match</button>
        </div>
      </form>
    </div>
  );
}
