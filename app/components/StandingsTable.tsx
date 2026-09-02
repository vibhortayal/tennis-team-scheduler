'use client';

import { Group } from '../teams';
import { TeamStandingRow } from '../lib/scoring';

const QUALIFYING_POSITIONS = 4;

function nsr(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function StandingsTable({
  rows,
  group,
  selectedTeamId,
}: {
  rows: TeamStandingRow[];
  group: Group;
  selectedTeamId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="empty">
        No completed matches yet. Standings will appear once results are
        entered.
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
              <th scope="col" title="Matches played">
                Played
              </th>
              <th scope="col" title="Wins – Losses">
                W–L
              </th>
              <th scope="col" title="Standing points">
                Pts
              </th>
              <th scope="col" title="Net Score Rate">
                Net SR
              </th>
              <th scope="col" title="Matches remaining">
                Rem
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map(row => {
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
                    <span className="team-number">#{row.teamId}</span>
                    <span className="standings-team-players">{row.players}</span>
                    {isOwnTeam && (
                      <span className="standings-you" aria-label="Your team">
                        YOU
                      </span>
                    )}
                  </td>

                  <td className="standings-players-cell">{row.players}</td>

                  <td className="standings-num">{row.matchesPlayed}</td>

                  <td className="standings-num">
                    {row.matchesWon}–{row.matchesLost}
                  </td>

                  <td className="standings-num standings-pts">
                    {row.totalPoints}
                  </td>

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

                  <td className="standings-num">{row.matchesRemaining}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="standings-footnote">
        Ranked by points, then Net Score Rate. Top 4 qualify.
      </p>
    </div>
  );
}

export function StandingsView({
  standingsA,
  standingsB,
  standingsGroup,
  onGroupChange,
  selectedTeamId,
}: {
  standingsA: TeamStandingRow[];
  standingsB: TeamStandingRow[];
  standingsGroup: Group;
  onGroupChange: (g: Group) => void;
  selectedTeamId?: string | null;
}) {
  const rows = standingsGroup === 'Group A' ? standingsA : standingsB;

  return (
    <>
      <div className="tabs">
        {(['Group A', 'Group B'] as Group[]).map(g => (
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
      />
    </>
  );
}
