'use client';

import { ScoreEntryState } from '../lib/scoring';

type SetRowProps = {
  label: string;
  setKey: 'set1' | 'set2' | 'set3';
  teamALabel: string;
  teamBLabel: string;
  entry: ScoreEntryState;
  onChange: (next: ScoreEntryState) => void;
  optional?: boolean;
};

function SetRow({ label, setKey, teamALabel, teamBLabel, entry, onChange, optional }: SetRowProps) {
  const aKey = `${setKey}A` as keyof ScoreEntryState;
  const bKey = `${setKey}B` as keyof ScoreEntryState;

  return (
    <div className="set-row">
      <span className="set-label">
        {label}
        {optional && <span className="set-optional"> (optional)</span>}
      </span>

      <div className="set-inputs">
        <div className="set-team-input">
          <span className="set-team-name" title={teamALabel}>
            {teamALabel}
          </span>

          <input
            type="number"
            min="0"
            max="99"
            value={entry[aKey]}
            onChange={(e) => onChange({ ...entry, [aKey]: e.target.value })}
            aria-label={`${label} games for ${teamALabel}`}
            className="score-input"
          />
        </div>

        <span className="set-vs">–</span>

        <div className="set-team-input set-team-input--right">
          <input
            type="number"
            min="0"
            max="99"
            value={entry[bKey]}
            onChange={(e) => onChange({ ...entry, [bKey]: e.target.value })}
            aria-label={`${label} games for ${teamBLabel}`}
            className="score-input"
          />

          <span className="set-team-name" title={teamBLabel}>
            {teamBLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export type ScoreEntryProps = {
  teamALabel: string;
  teamBLabel: string;
  entry: ScoreEntryState;
  error: string;
  onChange: (next: ScoreEntryState) => void;
};

export function ScoreEntry({ teamALabel, teamBLabel, entry, error, onChange }: ScoreEntryProps) {
  return (
    <div className="score-entry wide">
      <div className="score-entry-header">
        <span className="field-label">Match scores</span>
      </div>

      <div className="score-entry-legend">
        <span className="score-legend-left" title={teamALabel}>
          {teamALabel}
        </span>
        <span className="score-legend-vs">vs</span>
        <span className="score-legend-right" title={teamBLabel}>
          {teamBLabel}
        </span>
      </div>

      <SetRow
        label="Set 1"
        setKey="set1"
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
        entry={entry}
        onChange={onChange}
      />

      <SetRow
        label="Set 2"
        setKey="set2"
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
        entry={entry}
        onChange={onChange}
      />

      <SetRow
        label="Set 3"
        setKey="set3"
        teamALabel={teamALabel}
        teamBLabel={teamBLabel}
        entry={entry}
        onChange={onChange}
        optional
      />

      {error && <p className="score-error">{error}</p>}
    </div>
  );
}
