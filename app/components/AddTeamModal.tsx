import { FormEvent, useState } from 'react';
import { Group, TeamRecord } from '../teams';
import { validateNewTeam, NewTeamInput } from '../lib/teamValidation';

type AddTeamModalProps = {
  isOpen: boolean;
  defaultGroup: Group;
  existingTeams: readonly TeamRecord[];
  onClose: () => void;
  onSave: (input: NewTeamInput) => Promise<{ ok: boolean; error?: string }>;
};

export function AddTeamModal({
  isOpen,
  defaultGroup,
  existingTeams,
  onClose,
  onSave,
}: AddTeamModalProps) {
  const [teamNumber, setTeamNumber] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [group, setGroup] = useState<Group>(defaultGroup);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTeam, setCreatedTeam] = useState<{
    teamNumber: string;
    player1: string;
    player2: string;
    group: Group;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const input: NewTeamInput = {
      teamNumber,
      player1,
      player2,
      group,
    };

    const validation = validateNewTeam(input, existingTeams);
    if (validation.ok === false) {
      setError(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave(input);
      if (!result.ok) {
        setError(result.error || 'Failed to save team.');
        setIsSubmitting(false);
        return;
      }
      setCreatedTeam({
        teamNumber: validation.data.teamNumber,
        player1: validation.data.player1,
        player2: validation.data.player2,
        group: validation.data.group,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError('');
    setCreatedTeam(null);
    setTeamNumber('');
    setPlayer1('');
    setPlayer2('');
    onClose();
  };

  return (
    <div className="modal" role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-team-modal-heading"
      >
        <h2 id="add-team-modal-heading">Add doubles team</h2>
        <p>Register a new doubles team for the tournament.</p>

        {createdTeam ? (
          <div className="add-team-success">
            <div className="add-team-success-badge">TEAM ADDED SUCCESSFULLY</div>
            <div className="add-team-summary-card">
              <div className="team-line">
                <span className="team-number">#{createdTeam.teamNumber}</span>
                <span className="team-names">
                  {createdTeam.player1} &amp; {createdTeam.player2}
                </span>
              </div>
              <p className="add-team-group-tag">
                Assigned to: <b>{createdTeam.group}</b> (Active)
              </p>
            </div>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setCreatedTeam(null);
                  setTeamNumber('');
                  setPlayer1('');
                  setPlayer2('');
                  setError('');
                }}
              >
                Add another team
              </button>
              <button type="button" onClick={handleClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            )}

            <div className="fields">
              <label className="field">
                Team number
                <input
                  type="text"
                  value={teamNumber}
                  placeholder="e.g. 14"
                  onChange={(e) => {
                    setTeamNumber(e.target.value);
                    setError('');
                  }}
                  disabled={isSubmitting}
                  autoFocus
                  required
                />
              </label>

              <label className="field">
                League group
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value as Group)}
                  disabled={isSubmitting}
                  required
                >
                  <option value="Group A">Group A</option>
                  <option value="Group B">Group B</option>
                </select>
              </label>

              <label className="field">
                Player 1 name
                <input
                  type="text"
                  value={player1}
                  placeholder="First player name"
                  onChange={(e) => {
                    setPlayer1(e.target.value);
                    setError('');
                  }}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="field">
                Player 2 name
                <input
                  type="text"
                  value={player2}
                  placeholder="Second player name"
                  onChange={(e) => {
                    setPlayer2(e.target.value);
                    setError('');
                  }}
                  disabled={isSubmitting}
                  required
                />
              </label>
            </div>

            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding team...' : 'Add Team'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
