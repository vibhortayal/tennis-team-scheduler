/**
 * Tournament admin session helpers.
 *
 * The admin role is a UI-level gate: picking "Tournament Admin" in the
 * identity picker requires a password. Only the SHA-256 hash of the password
 * ships to the browser (NEXT_PUBLIC_ADMIN_PASSWORD_SHA256); the password
 * itself is never stored in the repo. The session lives in sessionStorage so
 * it ends when the tab closes and is never persisted to localStorage.
 *
 * This keeps honest people honest (no player stumbles into tournament
 * management). It is not cryptographic access control: the app has no
 * backend and Supabase RLS is open, so anyone with devtools could bypass it.
 */

const ADMIN_SESSION_KEY = 'ito-admin-session';

const hexDigest = async (value: string): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/** The expected password hash, configured via env. Empty when not configured. */
export const adminPasswordHash = (): string => process.env.NEXT_PUBLIC_ADMIN_PASSWORD_SHA256 || '';

/** Whether an admin password has been configured for this deployment. */
export const isAdminConfigured = (): boolean => adminPasswordHash().length > 0;

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Returns true when the password matches the configured hash. */
export const verifyAdminPassword = async (password: string): Promise<boolean> => {
  const expected = adminPasswordHash();
  if (!expected) return false;
  return safeEqual(await hexDigest(password), expected.toLowerCase());
};

/** Whether this tab currently holds an admin session. */
export const isAdminSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

export const setAdminSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  } catch {
    // Storage unavailable (private mode) — the in-memory identity still works
    // for this page load.
  }
};

export const clearAdminSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
};
