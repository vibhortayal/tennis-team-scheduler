'use client';

import { useEffect, useState } from 'react';
import { IDENTITY_KEY } from '../teams';
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

export function KheloRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
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
        return;
      }
      // Escape hatch already taken: never redirect.
      if (window.localStorage.getItem(STAY_KEY) === '1') return;
      // Admin: untouched.
      if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) === '1') return;

      // Default: viewer / unsure identity -> join page (tournament page is private).
      let dest = KHELO_JOIN_URL;
      try {
        const saved = window.localStorage.getItem(IDENTITY_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            viewing?: boolean;
            name?: string;
            teamId?: string;
          } | null;
          if (parsed && !parsed.viewing && parsed.name && parsed.teamId) {
            dest = KHELO_JOIN_URL; // signed-in player
          }
        }
      } catch {
        // Unparseable identity: stay on the viewer default.
      }
      setTarget(dest);
    } catch {
      // No window (SSR) or other failure: render nothing.
    }
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
