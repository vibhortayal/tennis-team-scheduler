'use client';

import { ReactNode, useEffect } from 'react';

export default function Template({ children }: { children: ReactNode }) {
  useEffect(() => {
    const sync = () => {
      const selects = Array.from(
        document.querySelectorAll<HTMLSelectElement>('form select')
      ).filter((select) => select.options.length === 7);
      if (selects.length < 2) return;
      const [first, opponent] = selects;
      if (first.value === opponent.value) {
        const alternative = Array.from(opponent.options).find(
          (option) => option.value !== first.value
        );
        if (alternative) {
          opponent.value = alternative.value;
          opponent.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      Array.from(first.options).forEach((option) => {
        option.hidden = option.value === opponent.value;
        option.disabled = option.value === opponent.value;
      });
      Array.from(opponent.options).forEach((option) => {
        option.hidden = option.value === first.value;
        option.disabled = option.value === first.value;
      });
    };
    const scheduleSync = () => window.setTimeout(sync, 0);
    document.addEventListener('change', scheduleSync);
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => {
      document.removeEventListener('change', scheduleSync);
      observer.disconnect();
    };
  }, []);
  return <>{children}</>;
}
