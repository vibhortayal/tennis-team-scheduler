import type { Identity } from '../teams';
import { teamDisplay } from '../teams';
import type { Match } from '../lib/matches';
import { canUpdateMatch, dateText, teamIds } from '../lib/matches';
import {
  buildBracket,
  nextKnockoutFixture,
  matchStage,
  type BracketSlotView,
  type KnockoutSlot,
  type Phase,
} from '../lib/knockout';

function SlotCard({
  slot,
  identity,
  onEdit,
}: {
  slot: BracketSlotView;
  identity: Identity;
  onEdit: (match: Match) => void;
}) {
  const match = slot.match;
  const canUpdate = match ? canUpdateMatch(match, identity) : false;
  const ids = match ? teamIds(match, 'Group A') : [];
  const winnerId = slot.winnerId;

  const teamLine = (id: string | null, label: string) => {
    const isWinner = id !== null && id === winnerId;
    return (
      <div className={isWinner ? 'team-line winner' : 'team-line'}>
        {id ? <span className="team-number">#{id}</span> : null}
        <span className="team-names">{label}</span>
        {isWinner && (
          <span className="winner-badge" aria-label="Winner" title="Winner">
            ★ Winner
          </span>
        )}
      </div>
    );
  };

  const actionLabel = !match
    ? null
    : match.status === 'Completed'
      ? 'Update score'
      : match.match_date
        ? 'Update match'
        : 'Schedule';

  return (
    <article className="card bracket-slot" key={slot.slot}>
      <div className="bracket-slot-head">
        <b>{slot.slot}</b>
        <span className="bracket-stage-badge">{slot.stageLabel}</span>
      </div>
      <div className="matchup">
        {teamLine(slot.firstId, slot.firstLabel)}
        <span className="versus">vs</span>
        {teamLine(slot.secondId, slot.secondLabel)}
      </div>
      {match ? (
        <>
          <p>
            {match.match_date ? dateText(match.match_date) : 'Date TBD'}
            {match.match_date ? ` · ${match.match_time.slice(0, 5)}` : ''} ·{' '}
            {match.court || 'Court TBD'} · <b>{match.status}</b>
          </p>
          {match.result && (
            <p>
              <b>{match.result}</b>
            </p>
          )}
          {canUpdate && actionLabel && (
            <button type="button" onClick={() => onEdit(match)}>
              {actionLabel}
            </button>
          )}
        </>
      ) : (
        <p className="empty">Awaiting {slot.stageLabel.toLowerCase()} results.</p>
      )}
      {match && !canUpdate && ids.length === 2 && (
        <p className="permission-note">Only players on this match can update it.</p>
      )}
    </article>
  );
}

export function BracketView({
  matches,
  identity,
  onEdit,
}: {
  matches: Match[];
  identity: Identity;
  onEdit: (match: Match) => void;
}) {
  const bracket = buildBracket(matches);
  const rounds: Array<{ title: string; slots: BracketSlotView[] }> = [
    { title: 'Quarterfinals', slots: bracket.filter((s) => s.stage === 'quarterfinal') },
    { title: 'Semifinals', slots: bracket.filter((s) => s.stage === 'semifinal') },
    { title: 'Final', slots: bracket.filter((s) => s.stage === 'final') },
  ];
  const final = bracket.find((s) => s.slot === 'F');
  const championId = final?.winnerId ?? null;

  return (
    <section className="bracket">
      <h2>Knockout Bracket</h2>
      {championId && (
        <p className="champion-banner" role="status">
          🏆 Champions: {teamDisplay('Group A', championId)}
        </p>
      )}
      {rounds.map((round) => (
        <div key={round.title} className="bracket-round">
          <h3>{round.title}</h3>
          <div className="grid">
            {round.slots.map((slot) => (
              <SlotCard key={slot.slot} slot={slot} identity={identity} onEdit={onEdit} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Replaces Smart Scheduling once the group stage is over: the opponent is
 * fixed by the bracket, so there is nothing to suggest — just the next
 * fixture (or a note that the player's tournament has ended).
 */
export function KnockoutSchedulePanel({
  matches,
  identity,
  phase,
  onSchedule,
}: {
  matches: Match[];
  identity: Identity;
  phase: Phase;
  onSchedule: (match: Match) => void;
}) {
  const isPlayer = !identity.viewing && !identity.admin && identity.teamId !== '';
  const next = isPlayer ? nextKnockoutFixture(matches, identity.teamId) : null;

  return (
    <section className="card">
      <h2>Smart Scheduling</h2>
      {phase === 'group' || !isPlayer ? (
        <p className="empty">
          {phase === 'group'
            ? 'Scheduling suggestions are available during the group stage.'
            : 'Knockout scheduling is managed from the Match Dashboard bracket.'}
        </p>
      ) : next ? (
        <>
          <p>
            Your {matchStage(next) === 'quarterfinal' ? 'quarterfinal' : matchStage(next)}:{' '}
            <b>
              {teamIds(next, 'Group A')
                .map((id) => teamDisplay('Group A', id))
                .join(' vs ')}
            </b>
          </p>
          <p>
            {next.match_date ? dateText(next.match_date) : 'Not scheduled yet'}
            {next.match_date ? ` · ${next.match_time.slice(0, 5)} · ${next.court}` : ''} ·{' '}
            <b>{next.status}</b>
          </p>
          <div className="actions">
            <button type="button" onClick={() => onSchedule(next)}>
              {next.match_date ? 'Update match' : 'Schedule match'}
            </button>
          </div>
        </>
      ) : (
        <p className="empty">
          Your tournament has ended. Follow the knockout bracket on the Match Dashboard.
        </p>
      )}
    </section>
  );
}

export type { KnockoutSlot };
