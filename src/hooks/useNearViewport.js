import { useEffect, useRef, useState } from 'react';

// Dice se un elemento è dentro (o vicino a) il contenitore scrollabile.
// Usato per caricare le immagini visibili ±1 e liberare quelle lontane:
// `loading="lazy"` da solo non conosce i confini di uno scroller orizzontale.
export function useNearViewport({ rootRef, rootMargin = '0px 320px', enabled = true } = {}) {
  const targetRef = useRef(null);
  const [near, setNear] = useState(
    () => !enabled || typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (!enabled) {
      setNear(true);
      return undefined;
    }
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: rootRef?.current ?? null, rootMargin }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, rootMargin, rootRef]);

  return [targetRef, near];
}
