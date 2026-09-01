'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Group, Identity, groups, IDENTITY_KEY, allPlayers, viewingIdentity, identityValue, teamDisplay } from './teams';
import { Match, Draft, Suggestion, blank, dateText, fremontNow, matchDateTime, currentDateInFremont, addDays, teamIds, existingFixture, matchesForTeam, restGapAroundDate } from './lib/matches';
import { api, supabaseKey as key, headers } from './lib/supabase';
import { Matchup, Section } from './components/MatchCard';
import { PlayerPicker } from './components/PlayerPicker';
import { IdentityPrompt, MatchModal } from './components/MatchModal';
import { SmartScheduling } from './components/SmartScheduling';
import { Styles } from './components/Styles';
type View = 'dashboard' | 'scheduling';

export default function Page() {
const [view, setView] = useState<View>('dashboard');
const [group, setGroup] = useState<Group>('Group B');
const [scheduleGroup, setScheduleGroup] = useState<Group>('Group B');
const [matches, setMatches] = useState<Match[]>([]);
const [filter, setFilter] = useState('All');
const [team, setTeam] = useState('');
const [first, setFirst] = useState('');
const [second, setSecond] = useState('');
const [draft, setDraft] = useState<Draft>(blank('Group B'));
const [editing, setEditing] = useState<Match | null>(null);
const [open, setOpen] = useState(false);
const [identityPromptOpen, setIdentityPromptOpen] = useState(false);
const [pendingIdentityValue, setPendingIdentityValue] = useState('');
const [note, setNote] = useState('');
const [suggestionTeam, setSuggestionTeam] = useState('');
const [yourGapDays, setYourGapDays] = useState(3);
const [opponentGapDays, setOpponentGapDays] = useState(3);
const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
const [suggestionNote, setSuggestionNote] = useState('');
const [suggestionOpponent, setSuggestionOpponent] = useState('');
const [identity, setIdentity] = useState<Identity>(viewingIdentity);
const roster = groups[group];
const scheduleRoster = groups[scheduleGroup];

const load = async () => {
if (!api || !key) {
setNote('Missing Supabase public environment settings.');
return;
}
const response = await fetch(`${api}?select=*&order=match_date.asc,match_time.asc`, { headers });
if (response.ok) {
setMatches(await response.json());
} else {
setNote('Could not load matches.');
}
};

useEffect(() => {
load();
}, []);

useEffect(() => {
try {
const saved = window.localStorage.getItem(IDENTITY_KEY);
if (!saved) {
return;
}
const parsed = JSON.parse(saved) as Identity;
const savedIdentity = parsed.viewing ? viewingIdentity : allPlayers.find(player => player.name === parsed.name && player.teamId === parsed.teamId && player.group === parsed.group);
if (savedIdentity) {
setIdentity(savedIdentity);
}
} catch {
setIdentity(viewingIdentity);
}
}, []);

const chooseIdentity = (nextIdentity: Identity) => {
setIdentity(nextIdentity);
window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));
setSuggestions([]);
setSuggestionNote('');
setSuggestionOpponent('');
if (!nextIdentity.viewing) {
setGroup(nextIdentity.group);
setScheduleGroup(nextIdentity.group);
setSuggestionTeam(nextIdentity.teamId);
} else {
setSuggestionTeam('');
}
};
useEffect(() => {
setTeam('');
if (!open) {
setFirst(groups[group][0][0]);
setSecond(groups[group][1][0]);
setDraft(blank(group));
}
}, [group, open]);

const scoped = useMemo(() => matches.filter(m => (m.league_group || 'Group B') === group && (filter === 'All' || m.status === filter) && (!team || teamIds(m, group).includes(team))), [matches, group, filter, team]);

const opponentOptions = useMemo(() => Array.from(new Set(suggestions.map(item => item.opponentId))), [suggestions]);

const visibleSuggestions = useMemo(() => {
const filtered = suggestionOpponent ? suggestions.filter(item => item.opponentId === suggestionOpponent) : Object.values(suggestions.reduce<Record<string, Suggestion>>((best, item) => {
if (!best[item.opponentId] || item.date < best[item.opponentId].date) {
best[item.opponentId] = item;
}
return best;
}, {}));
return filtered.sort((a, b) => a.date.localeCompare(b.date) || a.opponentId.localeCompare(b.opponentId));
}, [suggestions, suggestionOpponent]);

const nowInFremont = fremontNow();
const overdue = scoped.filter(m => m.status === 'Scheduled' && matchDateTime(m) < nowInFremont);
const upcoming = scoped.filter(m => m.status === 'Scheduled' && matchDateTime(m) >= nowInFremont);
const completed = scoped.filter(m => m.status === 'Completed');
const cancelled = scoped.filter(m => m.status === 'Cancelled');
const upcomingAll = matches.filter(m => m.status === 'Scheduled' && matchDateTime(m) >= nowInFremont).sort((a, b) => matchDateTime(a).localeCompare(matchDateTime(b)));
const nextMatchDate = upcomingAll[0]?.match_date || '';
const nextMatches = upcomingAll.filter(m => m.match_date === nextMatchDate);
const begin = (m?: Match) => {
setEditing(m || null);
if (m) {
setDraft({ ...m, league_group: group });
const ids = teamIds(m, group);
setFirst(ids[0] || roster[0][0]);
setSecond(ids[1] || roster[1][0]);
} else {
setDraft(blank(group));
setFirst(identity.teamId || roster[0][0]);
setSecond(roster.find(([id]) => id !== identity.teamId)?.[0] || roster[0][0]);
}
setOpen(true);
setNote('');
};

const startScheduling = () => {
if (identity.viewing) {
setPendingIdentityValue('');
setIdentityPromptOpen(true);
return;
}
begin();
};

const continueWithIdentity = () => {
const selected = allPlayers.find(player => identityValue(player) === pendingIdentityValue);
if (!selected) {
return;
}
chooseIdentity(selected);
setIdentityPromptOpen(false);
setPendingIdentityValue('');
setEditing(null);
setFirst(selected.teamId);
setSecond(groups[selected.group].find(([id]) => id !== selected.teamId)?.[0] || selected.teamId);
setDraft(blank(selected.group));
setOpen(true);
setNote('');
};
const findSuggestions = () => {
if (identity.viewing || !suggestionTeam) {
setSuggestionNote('Select who you are from the top-right menu first.');
setSuggestions([]);
setSuggestionOpponent('');
return;
}
const today = currentDateInFremont();
const possibleOpponents = scheduleRoster.map(([id]) => id).filter(id => id !== suggestionTeam).filter(opponentId => !existingFixture(matches, scheduleGroup, suggestionTeam, opponentId));
const candidates: Suggestion[] = [];
for (const opponentId of possibleOpponents) {
const yourMatches = matchesForTeam(matches, scheduleGroup, suggestionTeam);
const opponentMatches = matchesForTeam(matches, scheduleGroup, opponentId);
for (let offset = 1; offset <= 30; offset += 1) {
const date = addDays(today, offset);
const youHaveMatch = yourMatches.some(match => match.match_date === date);
const opponentHasMatch = opponentMatches.some(match => match.match_date === date);
if (youHaveMatch || opponentHasMatch) {
continue;
}
const yourGap = restGapAroundDate(yourMatches, date);
const opponentGap = restGapAroundDate(opponentMatches, date);
if (yourGap < yourGapDays || opponentGap < opponentGapDays) {
continue;
}
candidates.push({ opponentId, date, yourGap, opponentGap, score: yourGap + opponentGap });
}
}
const ranked = candidates.sort((a, b) => a.date.localeCompare(b.date) || a.opponentId.localeCompare(b.opponentId));
setSuggestions(ranked);
setSuggestionOpponent('');
setSuggestionNote(ranked.length ? 'Found suggested matches, sorted by date. Rest days count completed matches and scheduled upcoming matches.' : 'No suitable matches found in the next 30 days. Rest days count completed matches and scheduled upcoming matches.');
};

const scheduleSuggestion = (suggestion: Suggestion) => {
if (existingFixture(matches, scheduleGroup, suggestionTeam, suggestion.opponentId)) {
setSuggestionNote('That matchup is already scheduled or completed, so it cannot be suggested.');
setSuggestions(current => current.filter(item => item.opponentId !== suggestion.opponentId));
return;
}
setGroup(scheduleGroup);
setEditing(null);
setFirst(suggestionTeam);
setSecond(suggestion.opponentId);
setDraft({ ...blank(scheduleGroup), match_date: suggestion.date, match_time: '19:00', court: 'Court 2', league_group: scheduleGroup });
setOpen(true);
setNote('');
};
const save = async (e: FormEvent) => {
e.preventDefault();
if (first === second) {
setNote('Choose a different opponent.');
return;
}
if (!draft.match_date || !draft.match_time || !draft.court) {
setNote('Add a date, time, and court.');
return;
}
if (draft.status === 'Completed' && !draft.result?.trim()) {
setNote('Enter a result before completing the match.');
return;
}
if (draft.status === 'Cancelled' && !draft.cancellation_reason?.trim()) {
setNote('Enter a cancellation reason.');
return;
}
const conflict = matches.find(m => m.id !== editing?.id && (m.league_group || 'Group B') === group && m.match_date === draft.match_date && m.status !== 'Cancelled' && teamIds(m, group).some(id => id === first || id === second));
if (conflict) {
setNote('One of these teams already has an active match on that date.');
return;
}
const body = { ...draft, league_group: group, matchup: `Team #${first} vs Team #${second}` };
const response = await fetch(editing ? `${api}?id=eq.${editing.id}` : api, { method: editing ? 'PATCH' : 'POST', headers, body: JSON.stringify(body) });
if (!response.ok) {
setNote('Could not save the match.');
return;
}
setOpen(false);
setNote('Match saved successfully.');
load();
};
return (
<main className="app-shell">
<Styles />

<header className="top">
<div className="brand">
<span className="brand-mark" aria-hidden="true">{'\ud83c\udfbe'}</span>
<div className="brand-text">
<span className="brand-name">Innovation Tennis Open</span>
<span className="brand-tagline">Match scheduling, simplified</span>
</div>
</div>
<PlayerPicker identity={identity} onChange={chooseIdentity} />
</header>

<div className="tabs segmented" role="tablist">
<button type="button" role="tab" aria-selected={view === 'dashboard'} className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
<button type="button" role="tab" aria-selected={view === 'scheduling'} className={view === 'scheduling' ? 'active' : ''} onClick={() => setView('scheduling')}>Smart Scheduling</button>
</div>

{note && <p className="notice" role="status">{note}</p>}

{view === 'dashboard' ? (
<>
{nextMatches.length > 0 ? (
<section className="hero next-matches" aria-label="Next match">
<div className="wide-hero">
<div className="eyebrow">Next match {'\u00b7'} {dateText(nextMatchDate)}</div>
<div className="grid">
{nextMatches.map(m => {
const matchGroup = (m.league_group || 'Group B') as Group;
return (
<article className="match-card hero-card" key={m.id}>
<div className="match-card-head">
<span className="match-meta">{matchGroup} {'\u00b7'} {m.match_time.slice(0, 5)}</span>
<span className="court-tag">{m.court}</span>
</div>
<Matchup match={m} group={matchGroup} />
</article>
);
})}
</div>
</div>
</section>
) : (
<section className="hero empty-hero" aria-label="Next match">
<div>
<div className="eyebrow">Next match</div>
<h1>No matches on the calendar yet</h1>
<p>Schedule your next match to kick off the season.</p>
</div>
<button type="button" className="btn btn-primary" onClick={startScheduling}>Schedule a match</button>
</section>
)}

<div className="tabs segmented group-tabs">
{(['Group A', 'Group B'] as Group[]).map(g => (
<button type="button" className={group === g ? 'active' : ''} onClick={() => setGroup(g)} key={g}>{g} {'\u00b7'} {groups[g].length} teams</button>
))}
</div>

<button type="button" className="btn btn-primary btn-block group-schedule" onClick={startScheduling}>Schedule a match</button>

<div className="filters">
{['All', 'Scheduled', 'Completed', 'Cancelled'].map(x => (
<button type="button" className={filter === x ? 'active' : ''} onClick={() => setFilter(x)} key={x}>{x}</button>
))}
<select value={team} onChange={e => setTeam(e.target.value)} aria-label="Filter by team">
<option value="">All {group} teams</option>
{roster.map(([id]) => (
<option value={id} key={id}>{teamDisplay(group, id)}</option>
))}
</select>
</div>
{overdue.length > 0 && (
<section className="overdue-section">
<h2 className="overdue-heading">Action required {'\u2014'} {overdue.length} past match{overdue.length === 1 ? '' : 'es'}</h2>
<p className="overdue-copy">These scheduled match times have passed in Fremont. Mark each match completed with a result, or cancel it with a reason.</p>
<div className="grid">
{overdue.map(m => (
<article className="match-card overdue-card status-overdue" key={m.id}>
<div className="match-card-head">
<span className="status-pill status-pill-overdue">Update required</span>
<span className="match-meta">{dateText(m.match_date)} {'\u00b7'} {m.match_time.slice(0, 5)}</span>
</div>
<Matchup match={m} group={group} />
<div className="match-card-foot">
<span className="court-tag">{m.court}</span>
</div>
<button type="button" className="btn btn-primary card-action" onClick={() => begin(m)}>Update match details</button>
</article>
))}
</div>
</section>
)}

<Section title="Upcoming matches" list={upcoming} edit={begin} empty="No upcoming matches." group={group} />
<Section title="Recent results" list={completed} edit={begin} empty="No completed matches." group={group} />
<Section title="Cancelled matches" list={cancelled} edit={begin} empty="No cancelled matches." group={group} />
</>
) : (
<SmartScheduling identity={identity} scheduleGroup={scheduleGroup} suggestionTeam={suggestionTeam} yourGapDays={yourGapDays} opponentGapDays={opponentGapDays} suggestions={suggestions} visibleSuggestions={visibleSuggestions} opponentOptions={opponentOptions} suggestionOpponent={suggestionOpponent} suggestionNote={suggestionNote} matches={matches} onYourGap={setYourGapDays} onOpponentGap={setOpponentGapDays} onFind={findSuggestions} onOpponentFilter={setSuggestionOpponent} onSchedule={scheduleSuggestion} />
)}
{identityPromptOpen && (
<IdentityPrompt value={pendingIdentityValue} onValue={setPendingIdentityValue} onCancel={() => setIdentityPromptOpen(false)} onContinue={continueWithIdentity} />
)}

{open && (
<MatchModal group={group} roster={roster} editing={!!editing} first={first} second={second} draft={draft} note={note} onFirst={setFirst} onSecond={setSecond} onDraft={setDraft} onClose={() => setOpen(false)} onSubmit={save} />
)}
</main>
);
}
