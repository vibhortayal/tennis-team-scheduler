import { Group, Identity, teamDisplay } from '../teams';
import { Match, Suggestion, dateText } from '../lib/matches';
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
}: SmartSchedulingProps) {
  return (
    <section className="suggestions-panel">
      <div>
        <div className="eyebrow">SMART SCHEDULING</div>
        <h2>Find a fair date and available opponent</h2>
        <p>
          Your group and team come from the player selected in the top-right menu. To schedule on
          someone else&apos;s behalf, switch the selected player there first.
        </p>
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

          <div className="suggestion-step">
            <h3>Set rest-day rules</h3>
            <div className="suggestion-fields">
              <label className="field">
                Minimum days after your last match
                <select value={yourGapDays} onChange={e => onYourGap(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map(days => (
                    <option value={days} key={days}>
                      {days} day{days === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Minimum days after opponent&apos;s last match
                <select value={opponentGapDays} onChange={e => onOpponentGap(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map(days => (
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
              <select value={suggestionOpponent} onChange={e => onOpponentFilter(e.target.value)}>
                <option value="">All opponents</option>
                {opponentOptions.map(id => (
                  <option value={id} key={id}>
                    {teamDisplay(scheduleGroup, id)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {visibleSuggestions.length > 0 && (
            <div className="grid suggestion-grid">
              {visibleSuggestions.map(suggestion => (
                <article
                  className="card suggestion-card"
                  key={`${suggestion.opponentId}-${suggestion.date}`}
                >
                  <small>SUGGESTED MATCH</small>

                  <div className="matchup">
                    <TeamContext group={scheduleGroup} id={suggestionTeam} matches={matches} />
                    <span className="versus">vs</span>
                    <TeamContext group={scheduleGroup} id={suggestion.opponentId} matches={matches} />
                  </div>

                  <p>
                    <b>{dateText(suggestion.date)}</b>
                    <br />
                    Suggested start: 7:00 PM
                  </p>

                  <p className="gap-text">
                    Your rest:{' '}
                    {suggestion.yourGap === 99 ? 'No nearby match' : `${suggestion.yourGap} days`}
                    <br />
                    Opponent rest:{' '}
                    {suggestion.opponentGap === 99 ? 'No nearby match' : `${suggestion.opponentGap} days`}
                  </p>

                  <button onClick={() => onSchedule(suggestion)}>Schedule this match</button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
