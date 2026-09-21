import { Identity, identityValue, viewingIdentity } from '../teams';

export function PlayerPicker({
  identity,
  onChange,
  adminConfigured,
  onAdminSelect,
}: {
  identity: Identity;
  onChange: (next: Identity) => void;
  players?: Identity[];
  adminConfigured?: boolean;
  onAdminSelect?: () => void;
}) {
  // Read-only mode: player sign-in is disabled so all data entry happens on
  // KheloHQ. The picker keeps the viewer default and the admin login entry.
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
          if (value === 'admin') {
            onAdminSelect?.();
            return;
          }
        }}
      >
        <option value="viewing">Viewer</option>
        {adminConfigured && <option value="admin">🔒 Tournament Admin</option>}
      </select>
    </label>
  );
}
