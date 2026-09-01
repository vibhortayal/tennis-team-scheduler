import { Group, teamNames } from '../teams';
import { Match, dateText, teamIds, matchesForTeam, currentDateInFremont } from '../lib/matches';
import { teamDisplay } from '../teams';

type StatusKind = 'completed' | 'scheduled' | 'cancelled' | 'other';

function statusKind(status: string): StatusKind {
const s = status.toLowerCase();
if (s === 'completed') return 'completed';
if (s === 'scheduled') return 'scheduled';
if (s === 'cancelled' || s === 'canceled') return 'cancelled';
return 'other';
}

export function TeamLine({ group, id }: { group: Group; id: string }) {
return (
<div className="team-line">
<span className="team-badge" aria-hidden="true">{teamNames(group, id).charAt(0)}</span>
<span className="team-names">{teamNames(group, id)}</span>
</div>
);
}

export function teamMatchLine(match: Match, group: Group, id: string) {
const opponent = teamIds(match, group).find(teamId => teamId !== id);
const vs = opponent ? teamDisplay(group, opponent) : 'Opponent';
if (match.status.toLowerCase() === 'completed') {
return `${dateText(match.match_date)} vs ${vs}${match.result ? ` \u00b7 ${match.result}` : ''}`;
}
return `${dateText(match.match_date)} vs ${vs} \u00b7 ${match.match_time.slice(0, 5)} \u00b7 ${match.court}`;
}

export function TeamContext({ group, id, matches }: { group: Group; id: string; matches: Match[] }) {
const today = currentDateInFremont();
const teamMatches = matchesForTeam(matches, group, id);
const last = teamMatches
.filter(match => match.status.toLowerCase() === 'completed')
.sort((a, b) => b.match_date.localeCompare(a.match_date) || b.match_time.localeCompare(a.match_time))[0];
const next = teamMatches
.filter(match => match.status.toLowerCase() === 'scheduled' && match.match_date >= today)
.sort((a, b) => a.match_date.localeCompare(b.match_date) || a.match_time.localeCompare(b.match_time))[0];
return (
<div className="team-with-info">
<TeamLine group={group} id={id} />
<div className="info-inline">
<p><span className="info-label">Last match</span> {last ? teamMatchLine(last, group, id) : 'None yet'}</p>
<p><span className="info-label">Next match</span> {next ? teamMatchLine(next, group, id) : 'None scheduled'}</p>
</div>
</div>
);
}

export function Matchup({ match, group }: { match: Match; group: Group }) {
const ids = teamIds(match, group);
if (ids.length !== 2) return <h3 className="matchup-title">{match.matchup}</h3>;
return (
<div className="matchup">
<TeamLine group={group} id={ids[0]} />
<span className="versus">vs</span>
<TeamLine group={group} id={ids[1]} />
</div>
);
}
export function Section({ title, list, edit, empty, group }: { title: string; list: Match[]; edit: (m: Match) => void; empty: string; group: Group }) {
return (
<section className="match-section">
<h2 className="section-title">{title}</h2>
{list.length ? (
<div className="grid">
{list.map(m => {
const kind = statusKind(m.status);
return (
<article className={`match-card status-${kind}`} key={m.id}>
<div className="match-card-head">
<span className="match-meta">{`${dateText(m.match_date)} \u00b7 ${m.match_time.slice(0, 5)}`}</span>
<span className={`status-pill status-pill-${kind}`}>{m.status}</span>
</div>
<Matchup match={m} group={group} />
<div className="match-card-foot">
<span className="court-tag">{m.court}</span>
{m.result && <span className="result-tag">{m.result}</span>}
</div>
{m.cancellation_reason && <p className="cancel-reason">Reason: {m.cancellation_reason}</p>}
<button type="button" className="btn btn-ghost card-action" onClick={() => edit(m)}>Update match</button>
</article>
);
})}
</div>
) : (
<p className="empty">{empty}</p>
)}
</section>
);
}
