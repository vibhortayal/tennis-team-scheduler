import { FormEvent, useState, useEffect } from 'react';
import { Group, Team, allPlayers, identityValue, teamDisplay, teamNames } from '../teams';
import { Draft } from '../lib/matches';
import { matchStage } from '../lib/knockout';
import { ScoreEntryState, blankScoreEntry, scoreEntryFromResult } from '../lib/scoring';
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
          menu.
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
        <p className="khelo-note">
          Innovation Tennis player?{' '}
          <a
            href="https://khelohq.vercel.app/t/c11aa58d-acad-47be-bf2c-bf65d8630375/join"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join KheloHQ
          </a>{' '}
          for live scores, ratings &amp; more.
        </p>
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
  /** Knockout fixtures: teams are fixed by the bracket (players can't change them). */
  lockTeams?: boolean;
  /** The tournament admin can create arbitrary pairings and adjust stage/slot. */
  isAdmin?: boolean;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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
  lockTeams,
  isAdmin,
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
    onSubmit(e, scoreEntry);
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
          {editing ? 'Update' : 'Schedule'}{' '}
          {matchStage(draft) === 'group'
            ? `${group} match`
            : `${capitalize(matchStage(draft))} match`}
        </h2>
        {note && <p className="notice">{note}</p>}
        <div className="fields">
          <label className="field">
            First team
            <select value={first} onChange={(e) => onFirst(e.target.value)} disabled={lockTeams}>
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
            <select value={second} onChange={(e) => onSecond(e.target.value)} disabled={lockTeams}>
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

          {isAdmin && (
            <>
              <label className="field">
                Stage
                <select
                  value={draft.stage || 'group'}
                  onChange={(e) =>
                    onDraft({
                      ...draft,
                      stage: e.target.value,
                      knockout_slot: e.target.value === 'group' ? null : draft.knockout_slot,
                    })
                  }
                >
                  <option value="group">Group</option>
                  <option value="quarterfinal">Quarterfinal</option>
                  <option value="semifinal">Semifinal</option>
                  <option value="final">Final</option>
                </select>
              </label>

              {draft.stage && draft.stage !== 'group' && (
                <label className="field">
                  Bracket slot
                  <select
                    value={draft.knockout_slot || ''}
                    onChange={(e) => onDraft({ ...draft, knockout_slot: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'].map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {draft.status === 'Completed' && (
            <ScoreEntry
              teamALabel={firstLabel}
              teamBLabel={secondLabel}
              entry={scoreEntry}
              error={scoreError}
              onChange={(next) => {
                setScoreEntry(next);
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
