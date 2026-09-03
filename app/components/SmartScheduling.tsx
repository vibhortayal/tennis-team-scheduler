import { Group, Identity, teamDisplay } from '../teams';
import { Match, Suggestion, dateText } from '../lib/matches';
import { AvailabilityManager, AvailabilitySlot, SlotSaveInput } from './AvailabilityManager';
import { TeamContext } from './MatchCard';

type SmartSchedulingProps = {
  identity: Identity;
  scheduleGroup: Group;
  suggestionTeam: string;
  yourGapDays: number;
  opponentGapDays: number;
  suggestions: Suggestion[];
  visibleSuggestions: Suggestion[];
  opponentOptions: string[];
  suggestionOpponent: string;
  suggestionNote: string;
  matches: Match[];
  onYourGap: (v: number) => void;
  onOpponentGap: (v: number) => void;
  onFind: () => void;
  onOpponentFilter: (v: string) => void;
  onSchedule: (s: Suggestion) => void;
  availabilitySlots: AvailabilitySlot[];
  blockingSlots: AvailabilitySlot[];
  teamMatches: Match[];
  availabilitySaving: boolean;
  availabilityError: string;
  onSaveSlot: (input: SlotSaveInput) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
  copyReminder: () => void;
  copyMissingReminder: (names: string[]) => void;
  partnerName: string;
  partnerReady: boolean;
  remainingMatchCount: number;
};

export function SmartScheduling({
  identity,
  scheduleGroup,
  suggestionTeam,
  yourGapDays,
  opponentGapDays,
  suggestions,
  visibleSuggestions,
  opponentOptions,
  suggestionOpponent,
  suggestionNote,
  matches,
  onYourGap,
  onOpponentGap,
  onFind,
  onOpponentFilter,
  onSchedule,
  availabilitySlots,
  blockingSlots,
  teamMatches,
  availabilitySaving,
  availabilityError,
  onSaveSlot,
  onDeleteSlot,
  copyReminder,
  copyMissingReminder,
  partnerName,
  partnerReady,
  remainingMatchCount,
}: SmartSchedulingProps) {
  const initials = identity.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="suggestions-panel">
      <div className="personal-header">
        <div className="personal-avatar" aria-hidden="true">
          {initials}
        </div>
        <div>
          <div className="eyebrow">YOUR SCHEDULING DESK</div>
          <h2>
            {identity.viewing
              ? 'Make match day easier'
              : `Hi ${identity.name}, let's get your next match on the calendar.`}
          </h2>
        </div>
      </div>
      <div className="personal-summary">
        {identity.viewing ? (
          <p>Select your player name above to see your team, availability, and match options.</p>
        ) : (
          <>
            <p>Your personal match helper for the {scheduleGroup} league.</p>
            <div className="personal-stats">
              <span>
                <b>{remainingMatchCount}</b> remaining match{remainingMatchCount === 1 ? '' : 'es'}
              </span>
              <span>
                <b>{partnerName}</b> partner
              </span>
              <span>
                <b>{availabilitySlots.length}</b> availability window
                {availabilitySlots.length === 1 ? '' : 's'}
              </span>
            </div>
          </>
        )}
      </div>
      <div>
        <div className="eyebrow">SMART SCHEDULING</div>
        <p>{"Keep your availability current and we'll surface times that work for everyone."}</p>
      </div>

      {identity.viewing ? (
        <div className="suggestion-step">
          <h3>Select who you are</h3>
          <p>Choose a player from the top-right menu to use Smart Scheduling.</p>
        </div>
      ) : (
        <>
          {/* Group + Team are read-only; controlled by the header player picker */}
          <div className="suggestion-step">
            <h3>Your team</h3>
            <div className="known-team">
              <small>{scheduleGroup.toUpperCase()}</small>
              {teamDisplay(scheduleGroup, suggestionTeam)}
            </div>
            <p className="known-team-note">
              Group and team are set by the player selected in the top-right menu.
            </p>
          </div>

          <AvailabilityManager
            availabilitySlots={availabilitySlots}
            blockingSlots={blockingSlots}
            teamMatches={teamMatches}
            deadline="2026-09-30T23:59:59.999Z"
            saving={availabilitySaving}
            error={availabilityError}
            onSaveSlot={onSaveSlot}
            onDeleteSlot={onDeleteSlot}
          />

          {availabilitySlots.length === 0 ? (
            <div className="readiness-card readiness-warning" role="status">
              <b>Add your availability to unlock match suggestions before September 30.</b>
            </div>
          ) : !partnerReady ? (
            <div className="readiness-card readiness-warning" role="status">
              <b>Your availability is saved.</b> {partnerName} still needs to add availability
              before we can find shared match times.
              <button type="button" className="secondary" onClick={copyReminder}>
                Copy reminder
              </button>
            </div>
          ) : (
            <div className="readiness-card" role="status">
              <b>Your team is ready.</b> We are waiting on availability from opponents in your
              remaining matches.
              <button type="button" className="secondary" onClick={copyReminder}>
                Copy reminder
              </button>
            </div>
          )}

          <div className="suggestion-step">
            <h3>Set rest-day rules</h3>
            <div className="suggestion-fields">
              <label className="field">
                Minimum days after your last match
                <select value={yourGapDays} onChange={(e) => onYourGap(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                    <option value={days} key={days}>
                      {days} day{days === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Minimum days after opponent&apos;s last match
                <select
                  value={opponentGapDays}
                  onChange={(e) => onOpponentGap(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                    <option value={days} key={days}>
                      {days} day{days === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <button className="suggest-button" onClick={onFind}>
            Find available matches
          </button>

          {suggestionNote && <p className="suggestion-note">{suggestionNote}</p>}

          {suggestions.length > 0 && (
            <label className="field suggestion-filter">
              Filter by opponent
              <select value={suggestionOpponent} onChange={(e) => onOpponentFilter(e.target.value)}>
                <option value="">All opponents</option>
                {opponentOptions.map((id) => (
                  <option value={id} key={id}>
                    {teamDisplay(scheduleGroup, id)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {visibleSuggestions.length > 0 && (
            <div className="grid suggestion-grid">
              {visibleSuggestions.map((suggestion) => (
                <article
                  className="card suggestion-card"
                  key={`${suggestion.opponentId}-${suggestion.date}`}
                >
                  <small>{suggestion.allPlayersReady ? 'READY TO PROPOSE' : 'POSSIBLE TIME'}</small>

                  <div className="matchup">
                    <TeamContext group={scheduleGroup} id={suggestionTeam} matches={matches} />
                    <span className="versus">vs</span>
                    <TeamContext
                      group={scheduleGroup}
                      id={suggestion.opponentId}
                      matches={matches}
                    />
                  </div>

                  <p>
                    <b>{dateText(suggestion.date)}</b>
                    <br />
                    Suggested time:{' '}
                    {suggestion.startsAt
                      ? new Intl.DateTimeFormat('en-US', {
                          timeStyle: 'short',
                          timeZone: 'America/Los_Angeles',
                        }).format(new Date(suggestion.startsAt))
                      : '7:00 PM'}{' '}
                    -{' '}
                    {suggestion.endsAt
                      ? new Intl.DateTimeFormat('en-US', {
                          timeStyle: 'short',
                          timeZone: 'America/Los_Angeles',
                        }).format(new Date(suggestion.endsAt))
                      : ''}
                  </p>

                  <p className="gap-text">
                    Your rest:{' '}
                    {suggestion.yourGap === 99 ? 'No nearby match' : `${suggestion.yourGap} days`}
                    <br />
                    Opponent rest:{' '}
                    {suggestion.opponentGap === 99
                      ? 'No nearby match'
                      : `${suggestion.opponentGap} days`}
                  </p>

                  {suggestion.alternateCount ? (
                    <p>
                      {suggestion.alternateCount} alternate time
                      {suggestion.alternateCount === 1 ? '' : 's'} available
                    </p>
                  ) : null}

                  {!suggestion.allPlayersReady && suggestion.missingPlayers?.length ? (
                    <p className="missing-availability">
                      Waiting on {suggestion.missingPlayers.join(' and ')} to add availability.
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => copyMissingReminder(suggestion.missingPlayers || [])}
                      >
                        Copy reminder
                      </button>
                    </p>
                  ) : (
                    <p className="ready-availability">All required players are available.</p>
                  )}

                  <button
                    disabled={!suggestion.allPlayersReady}
                    onClick={() => onSchedule(suggestion)}
                    title={
                      suggestion.allPlayersReady
                        ? 'Open the proposal flow'
                        : 'Waiting for all players to add availability'
                    }
                  >
                    {suggestion.allPlayersReady ? 'Propose this time' : 'Waiting for availability'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
