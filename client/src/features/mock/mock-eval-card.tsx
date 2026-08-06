import { useTranslation } from "react-i18next";
import { Markdown } from "../../shared/markdown";
import type { MockEvaluation } from "../../shared/types";

// Shared by the static pool-based flow (mock.tsx) and the live voice interview
// (voice-interview.tsx) — its own file so neither has to import the other.
export function MockEvalCard({ ev }: { ev: MockEvaluation }) {
  const { t } = useTranslation("mock");
  if (ev.offline || ev.score === null) {
    return (
      <div className="mt-3 text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg p-2.5">
        {ev.verdict || t("eval.unavailable")}
      </div>
    );
  }
  const bar = ev.score >= 75 ? "bg-good" : ev.score >= 50 ? "bg-star" : "bg-rose-500";
  return (
    <div className="mt-3 rounded-lg border border-grid p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold text-ink">{ev.score}</span>
        <span className="text-xs text-ink-dim">/ 100</span>
        {ev.verdict && (
          <span className="text-sm text-ink-dim ml-1">
            <Markdown text={ev.verdict} inline />
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${ev.score}%` }} />
      </div>
      {ev.good && ev.good.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink">{t("eval.strengths")}</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {ev.good.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.missed && ev.missed.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600">{t("eval.missed")}</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {ev.missed.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.tip && (
        <div className="text-sm text-signal bg-signal/10 border border-signal/20 rounded p-2">
          <Markdown text={ev.tip} inline />
        </div>
      )}
    </div>
  );
}
