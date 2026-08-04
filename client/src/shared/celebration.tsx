import { useEffect } from "react";
import { useUi } from "./ui-state";
import type { CelebrationEvent } from "./use-celebration";

const CONFETTI_COLORS = ["#22c55e", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa"];
const CONFETTI_COUNT = 24;
const AUTO_DISMISS_MS = 3200;

/** Mounted once in Shell() — renders whatever `useFireCelebration()` (use-celebration.ts) last
 * fired, anywhere in the app, and auto-dismisses it after a few seconds. */
export function CelebrationOverlay() {
  const [active, setActive] = useUi<CelebrationEvent | null>("celebration.active", null);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [active, setActive]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[110] pointer-events-none overflow-hidden" aria-live="polite">
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const left = Math.round((i / CONFETTI_COUNT) * 100 + (i % 3) * 2);
        const delay = (i % 8) * 0.08;
        const duration = 1.8 + (i % 5) * 0.25;
        return (
          <span
            key={`${active.id}-${i}`}
            className="absolute -top-2.5 w-2 h-3 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `jt-confetti-fall ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-surface border border-grid rounded-xl shadow-lg px-5 py-3 flex items-center gap-2 animate-[jt-fade-in_0.3s_ease-out]">
        <span className="text-2xl">{active.emoji}</span>
        <span className="font-display font-semibold text-ink">{active.message}</span>
      </div>
    </div>
  );
}
