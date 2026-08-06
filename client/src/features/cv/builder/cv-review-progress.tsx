import { useTranslation } from "react-i18next";
import type { CvReviewStep } from "../../../shared/types";

// Mirrors the server's CV_REVIEW_STEPS order (server/src/modules/cv/cv-review-job.ts) — kept as a
// separate literal here (not imported) since the client can't import server code; the two must be
// kept in sync by hand, same as every other client-side mirror of a server type in this app.
const STEP_ORDER: CvReviewStep[] = ["preparing", "generating_feedback", "finalizing"];

// A Record (not a template literal built from the runtime step) so each value stays a literal key
// i18next's typed t() can verify against cv.json — same trick as roadmap.tsx's STATUS_LABEL_KEY.
const STEP_LABEL_KEY: Record<
  CvReviewStep,
  "builder.aiAssistantSteps.preparing" | "builder.aiAssistantSteps.generating_feedback" | "builder.aiAssistantSteps.finalizing"
> = {
  preparing: "builder.aiAssistantSteps.preparing",
  generating_feedback: "builder.aiAssistantSteps.generating_feedback",
  finalizing: "builder.aiAssistantSteps.finalizing",
};

/** A step list + thin progress bar for the CV Builder's backgrounded "AI Assistant" review (see
 * cv-review-job.ts) — this app's first "process + steps" indicator (elsewhere only a plain
 * percentage ProgressBar exists, e.g. the Analyzer's fetch-all job), so it's local to this feature
 * rather than promoted to shared/ui.tsx until a second consumer actually needs it. */
export function CvReviewProgress({ step }: { step: CvReviewStep | null }) {
  const { t } = useTranslation("cv");
  const currentIndex = step ? STEP_ORDER.indexOf(step) : -1;
  const pct = currentIndex >= 0 ? Math.round(((currentIndex + 1) / STEP_ORDER.length) * 100) : 0;
  return (
    <div className="space-y-2.5">
      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
        {/* `bg-star`, not `bg-signal` — this is a solid filled area, and `signal` flips to a pale
            indigo-300 in dark mode (tuned for text contrast, not a fill); see App.tsx's navBtn
            comment for the same bug at nav-item scale. */}
        <div className="h-full bg-star rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1.5">
        {STEP_ORDER.map((s, i) => {
          const state = currentIndex > i ? "done" : currentIndex === i ? "active" : "pending";
          return (
            <li key={s} className="flex items-center gap-2 text-xs">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  state === "done"
                    ? "bg-star text-on-signal"
                    : state === "active"
                      ? "border-2 border-signal text-signal animate-pulse"
                      : "border border-grid text-ink-dim"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "pending" ? "text-ink-dim" : "text-ink"}>{t(STEP_LABEL_KEY[s])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
