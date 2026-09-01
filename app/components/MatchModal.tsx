import { FormEvent } from 'react';
import { Group, Team, allPlayers, identityValue, teamDisplay } from '../teams';
import { Draft } from '../lib/matches';

export function IdentityPrompt({ value, onValue, onCancel, onContinue }: { value: string; onValue: (v: string) => void; onCancel: () => void; onContinue: () => void }) {
return (
<div className="modal">
<div className="identity-modal" role="dialog" aria-modal="true">
<h2>Welcome! Select your player</h2>
<p>Choose who you are so we can tailor scheduling to your team. You can change this anytime from the top-right menu.</p>
<label className="field">
Player
<select value={value} onChange={event => onValue(event.target.value)}>
<option value="">Select a player</option>
{allPlayers.map(player => (
<option key={identityValue(player)} value={identityValue(player)}>
{player.name} · {player.group} · #{player.teamId}
</option>
))}
</select>
</label>
<div className="actions">
<button className="secondary" type="button" onClick={onCancel}>Not now</button>
<button type="button" disabled={!value} onClick={onContinue}>Continue to scheduling</button>
</div>
</div>
</div>
);
}

type MatchModalProps = {
group: Group;
roster: readonly Team[];
editing: boolean;
first: string;
second: string;
draft: Draft;
note: string;
onFirst: (v: string) => void;
onSecond: (v: string) => void;
onDraft: (d: Draft) => void;
onClose: () => void;
onSubmit: (e: FormEvent) => void;
};
export function MatchModal({ group, roster, editing, first, second, draft, note, onFirst, onSecond, onDraft, onClose, onSubmit }: MatchModalProps) {
return (
<div className="modal">
<form onSubmit={onSubmit}>
<h2>{editing ? 'Update' : 'Schedule'} {group} match</h2>
{note && <p className="notice">{note}</p>}
<div className="fields">
<label className="field">
First team
<select value={first} onChange={e => onFirst(e.target.value)}>
{roster.filter(([id]) => id !== second).map(([id]) => (
<option value={id} key={id}>{teamDisplay(group, id)}</option>
))}
</select>
</label>
<label className="field">
Opponent
<select value={second} onChange={e => onSecond(e.target.value)}>
{roster.filter(([id]) => id !== first).map(([id]) => (
<option value={id} key={id}>{teamDisplay(group, id)}</option>
))}
</select>
</label>
<label className="field">
Date
<input type="date" value={draft.match_date} onChange={e => onDraft({ ...draft, match_date: e.target.value })} />
</label>
<label className="field">
Time
<input type="time" value={draft.match_time} onChange={e => onDraft({ ...draft, match_time: e.target.value })} />
</label>
<label className="field">
Court
<input value={draft.court} onChange={e => onDraft({ ...draft, court: e.target.value })} />
</label>
<label className="field">
Status
<select value={draft.status} onChange={e => onDraft({ ...draft, status: e.target.value })}>
{['Scheduled', 'Completed', 'Cancelled'].map(status => (
<option key={status}>{status}</option>
))}
</select>
</label>
{draft.status === 'Completed' && (
<label className="field wide">
Result
<textarea value={draft.result || ''} onChange={e => onDraft({ ...draft, result: e.target.value })} />
</label>
)}
{draft.status === 'Cancelled' && (
<label className="field wide">
Cancellation reason
<textarea value={draft.cancellation_reason || ''} onChange={e => onDraft({ ...draft, cancellation_reason: e.target.value })} />
</label>
)}
</div>
<div className="actions">
<button className="secondary" type="button" onClick={onClose}>Cancel</button>
<button>Save match</button>
</div>
</form>
</div>
);
}





