import { useTranslation } from "react-i18next";
import { Markdown } from "../../shared/markdown";
import type { DesignGrade } from "../../shared/types";

// Visually modeled on mock/mock-eval-card.tsx (score + colored bar, strengths/missed, a tip) but
// a distinct component — the shape differs (a criteria checklist, not just good/missed lists).
export function DesignGradeCard({ grade }: { grade: DesignGrade }) {
  const { t } = useTranslation("design");
  if (grade.score === 0 && grade.criteria.length === 0 && !grade.summary) {
    return <div className="mt-3 text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg p-2.5">{t("grade.unavailable")}</div>;
  }
  const bar = grade.score >= 75 ? "bg-good" : grade.score >= 50 ? "bg-star" : "bg-rose-500";
  return (
    <div className="mt-3 rounded-lg border border-grid p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold text-ink">{grade.score}</span>
        <span className="text-xs text-ink-dim">/ 100</span>
        {grade.summary && (
          <span className="text-sm text-ink-dim ml-1">
            <Markdown text={grade.summary} inline />
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${grade.score}%` }} />
      </div>
      {grade.offline && <div className="text-xs text-alert">{t("grade.offlineHeuristic")}</div>}
      {grade.criteria.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink">{t("grade.criteria")}</div>
          <ul className="space-y-1 mt-1">
            {grade.criteria.map((c, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span className={c.met ? "text-good" : "text-rose-600"} aria-hidden="true">
                  {c.met ? "✓" : "✗"}
                </span>
                <span className="text-ink">
                  {c.title}
                  {c.note && <span className="text-ink-dim"> — {c.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {grade.strengths.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-ink">{t("grade.strengths")}</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {grade.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {grade.missed.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-600">{t("grade.missed")}</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {grade.missed.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {grade.tip && (
        <div className="text-sm text-signal bg-signal/10 border border-signal/20 rounded p-2">
          <Markdown text={grade.tip} inline />
        </div>
      )}
    </div>
  );
}
