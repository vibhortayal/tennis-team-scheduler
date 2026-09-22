import { KheloRedirect } from './components/KheloRedirect';
import { KHELO_JOIN_URL } from './components/KheloPromo';
import { Styles } from './components/Styles';

/**
 * The old scheduler is retired. This page is now just the KheloHQ migration
 * banner plus an automatic redirect to the tournament on KheloHQ. There is
 * no standings view, no group selector, and no stay-on-old-site option.
 */
export default function Page() {
  return (
    <main>
      <Styles />
      <KheloRedirect />

      <section className="khelo-moved" aria-label="Tournament moved to KheloHQ">
        <div className="khelo-moved-text">
          <h2>This tournament has moved to KheloHQ</h2>
          <p>
            This scheduler is now read-only. To update scores, check standings, or
            schedule/reschedule matches, go to{' '}
            <a href={KHELO_JOIN_URL} target="_blank" rel="noopener noreferrer">
              KheloHQ
            </a>
            .
          </p>
        </div>
        <a
          className="khelo-moved-cta"
          href={KHELO_JOIN_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Join KheloHQ <span aria-hidden="true">→</span>
        </a>
      </section>
    </main>
  );
}
