import { useState } from 'react';
import { TeamRecord, Group } from '../teams';
import { Match, isBlockingStatus } from '../lib/matches';

export type WithdrawalResolution = 'walkover_all_opponents' | 'void_tournament_records';

type ManageTeamsModalProps = {
  isOpen: boolean;
  allTeams: readonly TeamRecord[];
  allMatches: readonly Match[];
  onClose: () => void;
  onToggle: (
    teamId: string,
    newStatus: 'active' | 'withdrawn',
    resolution?: WithdrawalResolution
  ) => Promise<{ ok: boolean; error?: string }>;
  onMoveTeam: (teamId: string, newGroup: Group) => Promise<{ ok: boolean; error?: string }>;
};

export function ManageTeamsModal({
  isOpen,
  allTeams,
  allMatches,
  onClose,
  onToggle,
  onMoveTeam,
}: ManageTeamsModalProps) {
  const [pendingWithdraw, setPendingWithdraw] = useState<string | null>(null);
  const [resolution, setResolution] = useState<WithdrawalResolution | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const [pendingMove, setPendingMove] = useState<string | null>(null);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const groupA = allTeams.filter((t) => t.group === 'Group A');
  const groupB = allTeams.filter((t) => t.group === 'Group B');

  const handleToggle = async (
    teamId: string,
    newStatus: 'active' | 'withdrawn',
    res?: WithdrawalResolution
  ) => {
    setLoadingId(teamId);
    setErrorId(null);
    setErrorMsg('');

    const result = await onToggle(teamId, newStatus, res);

    setLoadingId(null);
    if (!result.ok) {
      setErrorId(teamId);
      setErrorMsg(result.error || 'Failed to update team status.');
    } else {
      setPendingWithdraw(null);
      setResolution(null);
      setConfirmStep(false);
    }
  };

  const handleMove = async (teamId: string, newGroup: Group) => {
    setLoadingId(teamId);
    setErrorId(null);
    setErrorMsg('');

    const result = await onMoveTeam(teamId, newGroup);

    setLoadingId(null);
    if (!result.ok) {
      setErrorId(teamId);
      setErrorMsg(result.error || 'Failed to move team.');
    } else {
      setPendingMove(null);
    }
  };

  const handleClose = () => {
    setPendingWithdraw(null);
    setResolution(null);
    setConfirmStep(false);
    setPendingMove(null);
    setErrorId(null);
    setErrorMsg('');
    setLoadingId(null);
    onClose();
  };

  const renderTeam = (team: TeamRecord) => {
    const isWithdrawn = team.status === 'withdrawn';
    const isLoading = loadingId === team.teamId;
    const hasError = errorId === team.teamId;
    const isWithdrawing = pendingWithdraw === team.teamId;
    const isMoving = pendingMove === team.teamId;

    const teamMatches = allMatches.filter(
      (m) =>
        (m.league_group || 'Group B') === team.group && m.matchup.includes(`Team #${team.teamId}`)
    );
    const completedCount = teamMatches
      .filter((m) => m.status === 'Completed' || m.status === 'Retired' || m.status === 'Walkover')
      .filter((m) => !m.excluded_from_standings && m.status !== 'voided').length;
    const unplayedCount = teamMatches.filter(
      (m) => !isBlockingStatus(m.status) || m.status === 'Scheduled'
    ).length;

    const canMoveGroup = completedCount === 0 && !isWithdrawn;
    const oppositeGroup: Group = team.group === 'Group A' ? 'Group B' : 'Group A';

    return (
      <div
        key={team.teamId}
        className={`manage-team-row${isWithdrawn ? ' manage-team-row--withdrawn' : ''}`}
      >
        <div className="manage-team-info">
          <span className="manage-team-number">#{team.teamId}</span>
          <span className="manage-team-names">
            {team.player1} &amp; {team.player2}
          </span>
          <span className={`manage-team-badge manage-team-badge--${team.status}`}>
            {isWithdrawn ? 'Withdrawn' : 'Active'}
          </span>
        </div>

        {hasError && (
          <p className="manage-team-error" role="alert">
            {errorMsg}
          </p>
        )}

        {isWithdrawing ? (
          <div
            className="manage-team-confirm"
            style={{
              flexDirection: 'column',
              alignItems: 'stretch',
              marginTop: '10px',
              background: '#fef2f2',
              padding: '14px',
              borderRadius: '8px',
            }}
          >
            {!confirmStep ? (
              <>
                <p style={{ margin: '0 0 10px', fontWeight: 'bold' }}>
                  Select withdrawal resolution:
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`withdraw-${team.teamId}`}
                      checked={resolution === 'walkover_all_opponents'}
                      onChange={() => setResolution('walkover_all_opponents')}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '13px' }}>
                        Award 6–0, 6–0 walkovers to every opponent
                      </strong>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        Active opponents get points; completed scores kept but overridden for
                        standings.
                      </span>
                    </div>
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`withdraw-${team.teamId}`}
                      checked={resolution === 'void_tournament_records'}
                      onChange={() => setResolution('void_tournament_records')}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '13px' }}>
                        Remove team and void all tournament records
                      </strong>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        Team and matches excluded entirely from standings and normal schedules.
                      </span>
                    </div>
                  </label>
                </div>
                <div className="manage-team-confirm-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setPendingWithdraw(null);
                      setResolution(null);
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={() => setConfirmStep(true)} disabled={!resolution}>
                    Next
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="manage-team-confirm-text" style={{ marginBottom: '14px' }}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>You selected:</strong>{' '}
                    {resolution === 'walkover_all_opponents'
                      ? 'Award 6–0, 6–0 walkovers to every opponent.'
                      : 'Remove team and void all tournament records.'}
                  </p>
                  <p style={{ margin: 0 }}>
                    {resolution === 'walkover_all_opponents'
                      ? `This will affect ${completedCount} completed and ${unplayedCount} unplayed matches in ${team.group}. Original completed scores remain visible, but standings will use a 6–0, 6–0 walkover result for the opposing team.`
                      : `This will exclude ${completedCount} completed and ${unplayedCount} unplayed matches in ${team.group} from standings and normal schedule views. Historical records remain visible in gray for audit.`}
                  </p>
                  <p style={{ margin: '8px 0 0', fontWeight: 'bold' }}>Continue?</p>
                </div>
                <div className="manage-team-confirm-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setConfirmStep(false)}
                    disabled={isLoading}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleToggle(team.teamId, 'withdrawn', resolution!)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Withdrawing…' : 'Confirm Withdraw'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : isMoving ? (
          <div
            className="manage-team-confirm"
            style={{
              flexDirection: 'column',
              alignItems: 'stretch',
              marginTop: '10px',
              background: '#f8fbf7',
              padding: '14px',
              borderRadius: '8px',
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
              Move{' '}
              <strong>
                Team #{team.teamId} ({team.player1} &amp; {team.player2})
              </strong>{' '}
              from {team.group} to {oppositeGroup}?
            </p>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#5f7064' }}>
              This will cancel {unplayedCount} unplayed matches in {team.group}. No replacement
              fixtures will be automatically created.
            </p>
            <div className="manage-team-confirm-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setPendingMove(null)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMove(team.teamId, oppositeGroup)}
                disabled={isLoading}
              >
                {isLoading ? 'Moving…' : 'Confirm Move'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isWithdrawn &&
              (canMoveGroup ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPendingMove(team.teamId)}
                  disabled={isLoading}
                >
                  Move Group
                </button>
              ) : (
                <span
                  title={`Cannot move groups: Team #${team.teamId} already has a completed or standings-counted match.`}
                  style={{
                    fontSize: '12px',
                    color: '#888',
                    cursor: 'not-allowed',
                    padding: '6px 10px',
                  }}
                >
                  Move Group
                </span>
              ))}
            <button
              type="button"
              className={isWithdrawn ? '' : 'secondary danger-outline'}
              onClick={() =>
                isWithdrawn ? handleToggle(team.teamId, 'active') : setPendingWithdraw(team.teamId)
              }
              disabled={isLoading}
            >
              {isLoading
                ? isWithdrawn
                  ? 'Reactivating…'
                  : 'Processing…'
                : isWithdrawn
                  ? 'Reactivate'
                  : 'Withdraw'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (label: string, teams: TeamRecord[]) => (
    <div className="manage-teams-group">
      <h3 className="manage-teams-group-label">{label}</h3>
      {teams.length === 0 ? (
        <p className="manage-teams-empty">No teams in this group.</p>
      ) : (
        teams.map(renderTeam)
      )}
    </div>
  );

  return (
    <div className="modal" role="presentation">
      <div
        className="modal-card manage-teams-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-teams-heading"
      >
        <h2 id="manage-teams-heading">Manage teams</h2>
        <p>Withdraw a team or move them between groups before they start playing.</p>

        <div className="manage-teams-body">
          {renderGroup('Group A', groupA)}
          {renderGroup('Group B', groupB)}
        </div>

        <div className="actions">
          <button type="button" onClick={handleClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
