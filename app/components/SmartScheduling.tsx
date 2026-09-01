import { Group, Identity, teamDisplay } from '../teams';
import { Match, Suggestion, dateText } from '../lib/matches';

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

export function SmartScheduling(props: SmartSchedulingProps) {
const { identity, scheduleGroup, suggestionTeam, yourGapDays, opponentGapDays, suggestions, visibleSuggestions, opponentOptions, suggestionOpponent, suggestionNote, matches, onYourGap, onOpponentGap, onFind, onOpponentFilter, onSchedule } = props;
return (
<section className="suggestions-panel">
<div>
<div className="eyebrow">SMART SCHEDULING</div>
<h2>Find a fair date and available opponent</h2>
<p>Your group and team come from the player selected in the top-right menu. To schedule on someone else&apos;s behalf, switch the selected player there first.</p>
</div>
{identity.viewing ? (
<div className="suggestion-step">
<h3>Select who you are</h3>
<p>Choose a player from the top-right menu to use Smart Scheduling.</p>
</div>
) : (
<>

<div className="suggestion-step">
<h3>Your team</h3>
<div className="known-team">
<small>{scheduleGroup.toUpperCase()}</small>
{teamDisplay(scheduleGroup, suggestionTeam)}
</div>
</div>
<div className="suggestion-step">
<h3>Set rest-day rules</h3>
<div className="suggestion-fields">
<label className="field">
Minimum days after your last match
<select value={yourGapDays} onChange={e => onYourGap(Number(e.target.value))}>
{[1, 2, 3, 4, 5, 6, 7].map(days => (
<option value={days} key={days}>{days} day{days === 1 ? '' : 's'}</option>
))}
</select>
</label>
<label className="field">
Minimum days after opponent&apos;s last match
<select value={opponentGapDays} onChange={e => onOpponentGap(Number(e.target.value))}>
{[1, 2, 3, 4, 5, 6, 7].map(days => (
<option value={days} key={days}>{days} day{days === 1 ? '' : 's'}</option>
))}
</select>
</label>
</div>
</div>
<button className="suggest-button" onClick={onFind}>Find available matches</button>
{suggestionNote && <p className="suggestion-note">{suggestionNote}</p>}

<div className="suggestion-step">
<h3>Filter by opponent (optional)</h3>
<select value={suggestionOpponent} onChange={(e) => onOpponentFilter(e.target.value)}>
<option value="">All opponents</option>
{opponentOptions.map((name) => (
<option value={name} key={name}>{name}</option>
))}
</select>
</div>
<div className="suggestion-results">
{visibleSuggestions.length === 0 ? (
<p className="suggestion-empty">No available matches yet. Adjust the rest-day rules or opponent filter, then find matches.</p>
) : (
<ul className="suggestion-list">
{visibleSuggestions.map((suggestion) => (
<li className="suggestion-item" key={suggestion.id}>
<div className="suggestion-item-body">
<div className="suggestion-item-date">{dateText(suggestion.date)}</div>
<div className="suggestion-item-teams">
{teamDisplay(scheduleGroup, suggestionTeam)} vs {teamDisplay(suggestion.group, suggestion.opponent)}
</div>
{suggestion.reason && <div className="suggestion-item-reason">{suggestion.reason}</div>}
</div>
<button className="schedule-button" onClick={() => onSchedule(suggestion)}>Schedule match</button>
</li>
))}
</ul>
)}
</div>
</>
)}
</section>
);
}
