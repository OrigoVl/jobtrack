import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 700;

/** Ease-out cubic — fast start, settles gently into the target instead of a linear tick or an
 * abrupt stop. Exported standalone so the pure math is unit-testable without mounting a component
 * or faking `requestAnimationFrame`. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Animates a displayed number from its previous value up (or down) to `target` over `durationMs`
 * — used for the Dashboard's bento stat figures so a number that just resolved (or changed) draws
 * the eye instead of silently appearing. Only re-triggers when `target` itself changes (not on
 * unrelated re-renders), and starts from 0 the first time a component mounts with it — so on
 * first paint the headline figures visibly count up rather than just appearing static.
 * Skips straight to `target` under `prefers-reduced-motion: reduce`, matching this app's existing
 * convention (see shared/starfield.tsx) of never animating motion-sensitive users. */
export function useCountUp(target: number, durationMs: number = DEFAULT_DURATION_MS): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(Math.round(from + (target - from) * easeOutCubic(t)));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on `target` only, see doc comment
  }, [target]);

  return display;
}
