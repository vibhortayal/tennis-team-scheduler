'use client';

import { useEffect, useState } from 'react';
import { KHELO_PLAYER_LOGIN_EVENT } from '../teams';
import { KHELO_JOIN_URL } from './KheloPromo';

/**
 * Mid-season interstitial redirect to KheloHQ (owner GO 2026-09-21).
 *
 * Behavior (owner's exact parameters):
 * - 5-second interstitial window, then full-page navigation.
 * - Signed-in player (localStorage name-pick identity, not viewing) -> KheloHQ /join.
 * - Viewer or unsure identity -> KheloHQ /join as well: the tournament page is
 *   PRIVATE, so anonymous visitors only see a "this tournament is private"
 *   wall. /join renders inline sign-in and preserves the join path.
 *   (Owner's original param was viewer -> tournament page; switched 2026-09-21
 *   per Instinct's finding. One-line revert restores it.)
 * - Interstitial shows on page load AND on every player login (the app fires
 *   KHELO_PLAYER_LOGIN_EVENT whenever a player identity is chosen).
 * - Admin (sessionStorage admin session) -> untouched, no interstitial at all.
 * - Escape hatch (HARD requirement): "Stay on the old site" button or ?stay=1
 *   sets localStorage 'khelo-redirect-stay=1' and the interstitial never shows again.
 * - Nothing deleted; fully reversible by removing this component or the stay key.
 */
export const KHELO_TOURNAMENT_URL =
  'https://khelohq.vercel.app/t/c11aa58d-acad-47be-bf2c-bf65d8630375';

const STAY_KEY = 'khelo-redirect-stay';
const ADMIN_SESSION_KEY = 'ito-admin-session';
const REDIRECT_SECONDS = 5;

/**
 * Returns the KheloHQ URL to navigate to, or null when the interstitial is
 * suppressed (stay bypass taken, admin session, or SSR/no window).
 */
function resolveTarget(): string | null {
  try {
    const url = new URL(window.location.href);
    // ?stay=1: persist the bypass and clean the URL.
    if (url.searchParams.get('stay') === '1') {
      try {
        window.localStorage.setItem(STAY_KEY, '1');
      } catch {
        // Storage unavailable — interstitial simply shows again next visit.
      }
      url.searchParams.delete('stay');
      window.history.replaceState(null, '', url.toString());
      return null;
    }
    // Escape hatch already taken: never redirect.
    if (window.localStorage.getItem(STAY_KEY) === '1') return null;
    // Admin: untouched.
    if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') return null;

    // Everyone else — signed-in player, viewer, or unsure identity — goes to
    // the join page (the tournament page is private for anonymous visitors).
    return KHELO_JOIN_URL;
  } catch {
    // No window (SSR) or other failure: render nothing.
    return null;
  }
}

export function KheloRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    setTarget(resolveTarget());

    // Show the interstitial on every player login, not just page load.
    const onPlayerLogin = () => {
      const next = resolveTarget();
      if (next) setTarget(next);
    };
    window.addEventListener(KHELO_PLAYER_LOGIN_EVENT, onPlayerLogin);
    return () => window.removeEventListener(KHELO_PLAYER_LOGIN_EVENT, onPlayerLogin);
  }, []);

  useEffect(() => {
    if (!target) return;
    setSecondsLeft(REDIRECT_SECONDS);
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          window.location.href = target;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [target]);

  const stay = () => {
    try {
      window.localStorage.setItem(STAY_KEY, '1');
    } catch {
      // Storage unavailable — just hide for this visit.
    }
    setTarget(null);
  };

  if (!target) return null;

  return (
    <div
      className="khelo-redirect-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="khelo-redirect-heading"
    >
      <div className="khelo-redirect-card">
        <p className="khelo-redirect-kicker">We&apos;ve moved</p>
        <h2 id="khelo-redirect-heading">Innovation Tennis now lives on KheloHQ</h2>
        <p className="khelo-redirect-sub">
          Taking you to the tournament in <strong>{secondsLeft}s</strong>&hellip;
        </p>
        <a className="khelo-redirect-cta" href={target}>
          Continue to KheloHQ now &rarr;
        </a>
        <button className="khelo-redirect-stay" type="button" onClick={stay}>
          Stay on the old site
        </button>
      </div>
    </div>
  );
}
