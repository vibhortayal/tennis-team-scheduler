'use client';

import { useEffect, useRef, useState } from 'react';
import { Group } from '../teams';
import { Match } from '../lib/matches';
import { TeamStandingRow } from '../lib/scoring';
import { TeamMatchHistoryModal } from './TeamMatchHistoryModal';

const QUALIFYING_POSITIONS = 4;

function nsr(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function StandingsTable({
  rows,
  group,
  selectedTeamId,
  onTeamSelect,
}: {
  rows: TeamStandingRow[];
  group: Group;
  selectedTeamId?: string | null;
  onTeamSelect: (teamId: string, trigger: HTMLButtonElement | null) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="empty">
        No completed matches yet. Standings will appear once results are entered.
      </p>
    );
  }

  return (
    <div className="standings-wrap">
      <div className="standings-overflow">
        <table className="standings-table" aria-label={`${group} standings`}>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Team</th>
              <th scope="col" className="standings-players">
                Players
              </th>
              <th scope="col" title="Standing points">
                Pts
              </th>
              <th scope="col" title="Net Score Rate">
                Net SR
              </th>
              <th scope="col" title="Matches played">
                Played
              </th>
              <th scope="col" title="Matches won">
                Won
              </th>
              <th scope="col" title="Matches lost">
                Lost
              </th>
              <th scope="col" title="Games won">
                GW
              </th>
              <th scope="col" title="Games lost">
                GL
              </th>
              <th scope="col" title="Matches remaining">
                Rem
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const qualifying = row.groupRank <= QUALIFYING_POSITIONS;
              const isOwnTeam = selectedTeamId === row.teamId;
              const rowClass = [
                qualifying ? 'standings-qualifying' : '',
                isOwnTeam ? 'standings-own-team' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <tr key={row.teamId} className={rowClass}>
                  <td className="standings-rank">
                    {qualifying ? (
                      <span
                        className="standings-q-badge"
                        title="Qualifying position"
                        aria-label={`Rank ${row.groupRank} — qualifying`}
                      >
                        {row.groupRank}
                      </span>
                    ) : (
                      <span>{row.groupRank}</span>
                    )}
                  </td>

                  <td className="standings-team-cell">
                    <button
                      type="button"
                      className="standings-team-btn"
                      onClick={(event) => onTeamSelect(row.teamId, event.currentTarget)}
                      aria-label={`View matches for Team ${row.teamId}`}
                    >
                      <span className="team-number">#{row.teamId}</span>
                      <span className="standings-team-players">{row.players}</span>
                    </button>
                    {isOwnTeam && (
                      <span className="standings-you" aria-label="Your team">
                        YOU
                      </span>
                    )}
                  </td>

                  <td className="standings-players-cell">{row.players}</td>

                  <td className="standings-num standings-pts">{row.totalPoints}</td>

                  <td
                    className={`standings-num standings-nsr ${
                      row.netScoreRate > 0
                        ? 'standings-nsr--pos'
                        : row.netScoreRate < 0
                          ? 'standings-nsr--neg'
                          : ''
                    }`}
                  >
                    {nsr(row.netScoreRate)}
                  </td>

                  <td className="standings-num">{row.matchesPlayed}</td>

                  <td className="standings-num">{row.matchesWon}</td>

                  <td className="standings-num">{row.matchesLost}</td>

                  <td className="standings-num">{row.gamesWon}</td>

                  <td className="standings-num">{row.gamesLost}</td>

                  <td className="standings-num">{row.matchesRemaining}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="standings-footnote">Ranked by points, then Net Score Rate. Top 4 qualify.</p>
    </div>
  );
}

export function StandingsView({
  standingsA,
  standingsB,
  standingsGroup,
  onGroupChange,
  selectedTeamId,
  matches,
}: {
  standingsA: TeamStandingRow[];
  standingsB: TeamStandingRow[];
  standingsGroup: Group;
  onGroupChange: (g: Group) => void;
  selectedTeamId?: string | null;
  matches: Match[];
}) {
  const rows = standingsGroup === 'Group A' ? standingsA : standingsB;
  const [historyTeamId, setHistoryTeamId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // If the group tab changes while the dialog is open, close it so the
  // dialog never shows matches from the wrong group.
  useEffect(() => {
    setHistoryTeamId(null);
  }, [standingsGroup]);

  const openHistory = (teamId: string, trigger: HTMLButtonElement | null) => {
    triggerRef.current = trigger;
    setHistoryTeamId(teamId);
  };

  const closeHistory = () => {
    setHistoryTeamId(null);
    // Return focus to the team button that opened the dialog.
    triggerRef.current?.focus();
  };

  return (
    <>
      <div className="tabs">
        {(['Group A', 'Group B'] as Group[]).map((g) => (
          <button
            key={g}
            className={standingsGroup === g ? 'active' : ''}
            onClick={() => onGroupChange(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <StandingsTable
        rows={rows}
        group={standingsGroup}
        selectedTeamId={selectedTeamId}
        onTeamSelect={openHistory}
      />

      {historyTeamId && (
        <TeamMatchHistoryModal
          teamId={historyTeamId}
          group={standingsGroup}
          matches={matches}
          onClose={closeHistory}
        />
      )}
    </>
  );
}
