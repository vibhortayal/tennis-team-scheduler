import { FormEvent, useState } from 'react';
import { verifyAdminPassword } from '../lib/admin';

type AdminLoginProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

/** Password gate for the Tournament Admin role. */
export function AdminLogin({ onCancel, onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    setError('');
    try {
      const ok = await verifyAdminPassword(password);
      if (ok) {
        onSuccess();
      } else {
        setError('Incorrect password.');
      }
    } catch {
      setError('Could not verify the password. Try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit} className="modal-card" role="dialog" aria-modal="true">
        <h2>Tournament Admin</h2>
        <p>Enter the admin password to open tournament management.</p>
        {error && <p className="notice">{error}</p>}
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        <div className="actions">
          <button className="secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={checking || password.trim() === ''}>
            {checking ? 'Checking…' : 'Unlock admin'}
          </button>
        </div>
      </form>
    </div>
  );
}
