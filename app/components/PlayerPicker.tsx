import { Identity, allPlayers, identityValue, viewingIdentity } from '../teams';

export function PlayerPicker({ identity, onChange }: { identity: Identity; onChange: (next: Identity) => void }) {
return (
<select
className="identity-select"
aria-label="Select player"
value={identityValue(identity)}
onChange={event => {
const value = event.target.value;
if (value === 'viewing') {
onChange(viewingIdentity);
return;
}
const selected = allPlayers.find(player => identityValue(player) === value);
if (selected) onChange(selected);
}}
>
<option value="viewing">Select player</option>
{allPlayers.map(player => (
<option key={identityValue(player)} value={identityValue(player)}>
{player.name} · {player.group} · #{player.teamId}
</option>
))}
</select>
);
}

