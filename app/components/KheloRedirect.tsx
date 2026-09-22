'use client';

import { useEffect, useState } from 'react';
import { KHELO_JOIN_URL } from './KheloPromo';

/**
 * Redirect interstitial to KheloHQ (owner GO 2026-09-22).
 *
 * The old scheduler is retired: every visitor gets a 5-second interstitial,
 * then a full-page navigation to the KheloHQ tournament join page. There is
 * no stay-on-old-site option anymore.
 */
export const KHELO_TOURNAMENT_URL =
  'https://khelohq.vercel.app/t/c11aa58d-acad-47be-bf2c-bf65d8630375';

const REDIRECT_SECONDS = 5;

export function KheloRedirect() {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          window.location.href = KHELO_JOIN_URL;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

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
        <a className="khelo-redirect-cta" href={KHELO_JOIN_URL}>
          Continue to KheloHQ now &rarr;
        </a>
      </div>
    </div>
  );
}
