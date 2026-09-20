export const KHELO_JOIN_URL =
  'https://khelohq.vercel.app/t/c11aa58d-acad-47be-bf2c-bf65d8630375/join';

export function KheloPromoModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="modal">
      <div
        className="modal-card khelo-promo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="khelo-promo-heading"
      >
        <button
          className="khelo-promo-close"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
        <p className="khelo-promo-kicker">🚀 Big upgrade</p>
        <h2 id="khelo-promo-heading">Innovation Tennis is leveling up on KheloHQ</h2>
        <p className="khelo-promo-sub">
          We&apos;re moving the tournament to KheloHQ — a proper tournament app built for players
          like you. This scheduler stays, but the real action is over there.
        </p>
        <ul className="khelo-promo-features">
          <li>🏆 Live brackets, scores &amp; standings — follow every match as it happens</li>
          <li>📈 Your personal player rating that climbs with every win</li>
          <li>🕘 Full match history &amp; head-to-head records</li>
          <li>⚔️ Challenge any player to a match, anytime</li>
        </ul>
        <a
          className="khelo-promo-cta"
          href={KHELO_JOIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
        >
          Join the tournament on KheloHQ →
        </a>
        <button className="khelo-promo-later" type="button" onClick={onDismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
