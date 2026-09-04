import { useMemo, useState } from 'react';
import { Group, Identity, teamDisplay, teamNames } from '../teams';
import {
  Match,
  Suggestion,
  dateText,
  isBlockingStatus,
  teamIds,
} from '../lib/matches';
import { AvailabilityManager, AvailabilitySlot, SlotSaveInput } from './AvailabilityManager';
import { TeamContext } from './MatchCard';
import {
  DEFAULT_MATCH_DURATION_MINUTES,
  effectiveWindowsForPlayer,
  generateSuggestedStarts,
  intersectTimeWindows,
  playerKeysForTeam,
} from '../lib/scheduling';
import { getPlayableTimeWindows, normalizeDate } from '../lib/availabilityHelpers';

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
  participantStatusMap: Map<string, import('./MultiDateCalendar').DateParticipantStatus>;
  availabilitySaving: boolean;
  availabilityError: string;
  onSaveSlot: (input: SlotSaveInput) => Promise<void>;
  onDeleteSlot: (id: string) => Promise<void>;
  partnerName: string;
  partnerReady: boolean;
  pendingMatchCount: number;
  pendingOpponentIds: string[];
  opponentMissingNames: string[];
  availabilityOpponents: string[];
  onAvailabilityOpponentToggle: (value: string) => void;
  allAvailability: AvailabilitySlot[];
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
  participantStatusMap,
  availabilitySaving,
  availabilityError,
  onSaveSlot,
  onDeleteSlot,
  partnerName,
  partnerReady,
  pendingMatchCount,
  pendingOpponentIds,
  opponentMissingNames,
  availabilityOpponents,
  onAvailabilityOpponentToggle,
  allAvailability,
}: SmartSchedulingProps) {
  const [schedulingTab, setSchedulingTab] = useState<'overview' | 'availability'>('overview');
  const [availabilityCheckDate, setAvailabilityCheckDate] = useState('');
  const [availabilityCheckSlot, setAvailabilityCheckSlot] = useState('');
  const initials = identity.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const gameSummary = (match?: Suggestion['yourPreviousGame']) => {
    if (!match) return 'None';
    const time = match.time?.slice(0, 5) || '';
    const opponent = match.opponentId ? ` vs Team #${match.opponentId}` : '';
    return `${dateText(match.date)}${time ? ` (${time})` : ''}${opponent}`;
  };
  const slotOptions = useMemo(
    () => (availabilityCheckDate ? getPlayableTimeWindows(availabilityCheckDate) : []),
    [availabilityCheckDate]
  );
  const selectedSlotRange = useMemo(() => {
    if (!availabilityCheckDate || !availabilityCheckSlot) return null;
    const [start, end] = availabilityCheckSlot.split('-');
    const startsAt = new Date(`${availabilityCheckDate}T${start}:00`);
    const endsAt = new Date(`${availabilityCheckDate}T${end}:00`);
    if (
      Number.isNaN(startsAt.valueOf()) ||
      Number.isNaN(endsAt.valueOf()) ||
      endsAt <= startsAt
    ) {
      return null;
    }
    return { startsAt, endsAt };
  }, [availabilityCheckDate, availabilityCheckSlot]);
  const slotHasMatchDuration = useMemo(() => {
    if (!selectedSlotRange) return false;
    return (
      selectedSlotRange.endsAt.valueOf() - selectedSlotRange.startsAt.valueOf() >=
      DEFAULT_MATCH_DURATION_MINUTES * 60_000
    );
  }, [selectedSlotRange]);
  const availabilityByPlayer = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    allAvailability.forEach((slot) => {
      map.set(slot.playerId, [...(map.get(slot.playerId) || []), slot]);
    });
    return map;
  }, [allAvailability]);
  const availableTeamsForSlot = useMemo(() => {
    if (!selectedSlotRange || !slotHasMatchDuration || !suggestionTeam) return [];
    const canPlayWithinSlot = (participantKeys: string[]) => {
      const participantWindows = participantKeys.map((playerKey) => {
        const slots = availabilityByPlayer.get(playerKey) || [];
        return effectiveWindowsForPlayer(slots);
      });
      const sharedWindows = intersectTimeWindows(participantWindows);
      return sharedWindows.some((window) =>
        generateSuggestedStarts(window, DEFAULT_MATCH_DURATION_MINUTES).some((start) => {
          const end = new Date(start.valueOf() + DEFAULT_MATCH_DURATION_MINUTES * 60_000);
          return start >= selectedSlotRange.startsAt && end <= selectedSlotRange.endsAt;
        })
      );
    };
    const yourPlayers = playerKeysForTeam(scheduleGroup, suggestionTeam);
    return pendingOpponentIds.filter((opponentId) => {
      const participants = [...yourPlayers, ...playerKeysForTeam(scheduleGroup, opponentId)];
      const participantSet = new Set(participants);
      const hasExplicitBlock = participants.some((playerId) =>
        (availabilityByPlayer.get(playerId) || []).some(
          (slot) => {
            if ((slot.kind ?? 'available') !== 'blocked') return false;
            if (normalizeDate(slot.startsAt) !== availabilityCheckDate) return false;
            const blockedStart = new Date(slot.startsAt);
            const blockedEnd = new Date(slot.endsAt);
            return blockedStart < selectedSlotRange.endsAt && blockedEnd > selectedSlotRange.startsAt;
          }
        )
      );
      if (hasExplicitBlock) return false;
      const hasMatchOnDate = matches.some((match) => {
        if ((match.league_group || 'Group B') !== scheduleGroup) return false;
        if (!isBlockingStatus(match.status) || match.match_date !== availabilityCheckDate) return false;
        const ids = teamIds(match, scheduleGroup);
        const matchParticipants = ids.flatMap((teamId) => playerKeysForTeam(scheduleGroup, teamId));
        return matchParticipants.some((playerKey) => participantSet.has(playerKey));
      });
      if (hasMatchOnDate) return false;
      return canPlayWithinSlot(participants);
    });
  }, [
    availabilityByPlayer,
    availabilityCheckDate,
    matches,
    pendingOpponentIds,
    scheduleGroup,
    selectedSlotRange,
    slotHasMatchDuration,
    suggestionTeam,
  ]);
  const unavailableTeamsForSlot = useMemo(
    () =>
      !suggestionTeam
        ? []
        : pendingOpponentIds.filter((teamId) => !availableTeamsForSlot.includes(teamId)),
    [availableTeamsForSlot, pendingOpponentIds, suggestionTeam]
  );

  return (
    <section className="suggestions-panel">
      {!identity.viewing && (
        <div className="scheduling-tabs" role="tablist" aria-label="Scheduling view">
          <button
            type="button"
            className={schedulingTab === 'overview' ? '' : 'secondary'}
            aria-pressed={schedulingTab === 'overview'}
            onClick={() => setSchedulingTab('overview')}
          >
            Matchup overview
          </button>
          <button
            type="button"
            className={schedulingTab === 'availability' ? '' : 'secondary'}
            aria-pressed={schedulingTab === 'availability'}
            onClick={() => setSchedulingTab('availability')}
          >
            Update my availability
          </button>
        </div>
      )}

      <div className={schedulingTab === 'overview' ? '' : 'hidden'}>
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
                  <b>{pendingMatchCount}</b> to be scheduled
                </span>
                <span>
                  <b>{partnerName}</b> partner
                </span>
                <span>
                  <b>{availabilitySlots.length}</b> availability window
                  {availabilitySlots.length === 1 ? '' : 's'}
                </span>
              </div>
              {pendingOpponentIds.length > 0 ? (
                <div className="pending-matchups" role="status">
                  <div className="pending-matchups-header">
                    <span className="eyebrow">REMAINING MATCHUPS</span>
                    <span className="pending-matchup-count">{pendingOpponentIds.length}</span>
                  </div>
                  <p className="pending-matchups-hint">
                    Select one or more teams to compare on the availability calendar.
                  </p>
                  <div className="pending-matchup-list">
                    {pendingOpponentIds.map((id) => (
                      <button
                        type="button"
                        className={`pending-matchup ${availabilityOpponents.includes(id) ? 'selected' : ''}`}
                        aria-pressed={availabilityOpponents.includes(id)}
                        onClick={() => onAvailabilityOpponentToggle(id)}
                        key={id}
                      >
                        <span className="team-number">#{id}</span>
                        <span className="team-names">{teamNames(scheduleGroup, id)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="pending-matchups-complete" role="status">
                  All team matchups are scheduled or completed.
                </p>
              )}
            </>
          )}
        </div>
        <div>
          <div className="eyebrow">SMART SCHEDULING</div>
          <p>{"Keep your availability current and we'll surface times that work for everyone."}</p>
        </div>
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
            participantStatusMap={participantStatusMap}
            readOnly={schedulingTab === 'overview'}
            deadline="2026-09-30T23:59:59.999Z"
            saving={availabilitySaving}
            error={availabilityError}
            onSaveSlot={onSaveSlot}
            onDeleteSlot={onDeleteSlot}
          />

          <div className={schedulingTab === 'overview' ? '' : 'hidden'}>
            {availabilitySlots.length === 0 ? (
              <div className="readiness-card readiness-warning" role="status">
                <b>Add your availability to unlock match suggestions before September 30.</b>
              </div>
            ) : !partnerReady ? (
              <div className="readiness-card readiness-warning" role="status">
                <b>Your availability is saved.</b> {partnerName} still needs to add availability
                before we can find shared match times.
              </div>
            ) : (
              <div className="readiness-card" role="status">
                <b>Your team is ready.</b>{' '}
                {opponentMissingNames.length > 0 ? (
                  <>Availability is still needed from {opponentMissingNames.join(' and ')}.</>
                ) : (
                  'All opponents in your remaining matches have entered availability.'
                )}
              </div>
            )}

            <div className="suggestion-step">
              <h3>Quick availability check</h3>
              <p>Select a date and slot to see which teams can play you in that window.</p>
              <div className="availability-checker">
                <label className="field">
                  Date
                  <input
                    type="date"
                    value={availabilityCheckDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      const nextSlots = nextDate ? getPlayableTimeWindows(nextDate) : [];
                      setAvailabilityCheckDate(nextDate);
                      setAvailabilityCheckSlot(nextSlots[0]?.value ?? '');
                    }}
                  />
                </label>
                <label className="field">
                  Slot
                  <select
                    value={availabilityCheckSlot}
                    onChange={(event) => setAvailabilityCheckSlot(event.target.value)}
                    disabled={!availabilityCheckDate}
                  >
                    <option value="">Select slot</option>
                    {slotOptions.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {availabilityCheckDate && availabilityCheckSlot && !slotHasMatchDuration && (
                <p className="availability-check-note">
                  This slot is shorter than {DEFAULT_MATCH_DURATION_MINUTES / 60} hours.
                </p>
              )}
              {availabilityCheckDate && availabilityCheckSlot && slotHasMatchDuration && (
                <div className="availability-check-results" role="status">
                  {!suggestionTeam ? (
                    <p className="availability-check-note">Select your player/team first.</p>
                  ) : (
                    <>
                      <p className="availability-check-note">
                        {availableTeamsForSlot.length > 0
                          ? `${availableTeamsForSlot.length} team${availableTeamsForSlot.length === 1 ? '' : 's'} available in this slot.`
                          : 'No pending teams are fully available in this slot yet.'}
                      </p>
                      {availableTeamsForSlot.length > 0 && (
                        <div className="availability-team-list">
                          {availableTeamsForSlot.map((teamId) => (
                            <span className="availability-team availability-team--ready" key={teamId}>
                              {teamDisplay(scheduleGroup, teamId)}
                            </span>
                          ))}
                        </div>
                      )}
                      {unavailableTeamsForSlot.length > 0 && (
                        <div className="availability-team-list">
                          {unavailableTeamsForSlot.map((teamId) => (
                            <span
                              className="availability-team availability-team--not-ready"
                              key={teamId}
                            >
                              {teamDisplay(scheduleGroup, teamId)}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="suggestion-step">
              <h3>Set rest-day rules</h3>
              <div className="suggestion-fields">
                <label className="field">
                  Minimum days before and after your matches
                  <select value={yourGapDays} onChange={(e) => onYourGap(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                      <option value={days} key={days}>
                        {days} day{days === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Minimum days before and after opponent matches
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
                <select
                  value={suggestionOpponent}
                  onChange={(e) => onOpponentFilter(e.target.value)}
                >
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
                    <small>
                      {suggestion.allPlayersReady ? 'READY TO PROPOSE' : 'POSSIBLE TIME'}
                    </small>

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
                    <p className="availability-check-note">
                      Availability updated by {suggestion.playersWithAvailability ?? 0}/
                      {suggestion.totalPlayers ?? 4} players.
                    </p>
                    <p className="gap-text">
                      Your previous game: {gameSummary(suggestion.yourPreviousGame)}
                      <br />
                      Your next game: {gameSummary(suggestion.yourNextGame)}
                      <br />
                      Opponent previous game: {gameSummary(suggestion.opponentPreviousGame)}
                      <br />
                      Opponent next game: {gameSummary(suggestion.opponentNextGame)}
                    </p>

                    {suggestion.alternateCount ? (
                      <p>
                        {suggestion.alternateCount} alternate time
                        {suggestion.alternateCount === 1 ? '' : 's'} available
                      </p>
                    ) : null}

                    {!suggestion.allPlayersReady && suggestion.missingPlayers?.length ? (
                      <p className="missing-availability">
                        Availability is still needed from {suggestion.missingPlayers.join(' and ')}.
                      </p>
                    ) : (
                      <p className="ready-availability">All players available - schedule now.</p>
                    )}

                    <button
                      onClick={() => onSchedule(suggestion)}
                      title={
                        suggestion.allPlayersReady
                          ? 'Open the proposal flow'
                          : 'Confirmed by players over chat'
                      }
                    >
                      {suggestion.allPlayersReady
                        ? 'Propose this time'
                        : 'Confirmed by players over chat'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
