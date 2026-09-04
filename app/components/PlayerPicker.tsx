import { Identity, allPlayers, identityValue, viewingIdentity } from '../teams';

export function PlayerPicker({
  identity,
  onChange,
  players,
}: {
  identity: Identity;
  onChange: (next: Identity) => void;
  players?: Identity[];
}) {
  const playerList = players || allPlayers;
  const sortedPlayers = [...playerList].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <label className="identity-picker">
      <span className="identity-picker-label">Logged in as</span>
      <select
        className="identity-select"
        aria-label="Select player"
        value={identityValue(identity)}
        onChange={(event) => {
          const value = event.target.value;
          if (value === 'viewing') {
            onChange(viewingIdentity);
            return;
          }
          const selected = playerList.find((player) => identityValue(player) === value);
          if (selected) onChange(selected);
        }}
      >
        <option value="viewing">Select player ▾</option>
        {sortedPlayers.map((player) => (
          <option key={identityValue(player)} value={identityValue(player)}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}
