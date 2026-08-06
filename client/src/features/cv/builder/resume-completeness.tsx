import { useTranslation } from "react-i18next";
import type { CvDoc } from "../../../shared/types";

/** Small "how complete is this resume" widget — 7 binary checks (general info, summary, skills,
 * experience, projects, education, languages), shown as a % + progress bar + missing list.
 * Sits above the accordion nav so it's the first thing you see, not buried at the bottom. */
export function ResumeCompleteness({ doc, bare = false }: { doc: CvDoc; bare?: boolean }) {
  const { t } = useTranslation(["cv", "common"]);
  const checks: [boolean, string][] = [
    [!!(doc.name.trim() && doc.title.trim() && doc.contact.trim()), t("completeness.checks.generalInfo")],
    [doc.summary.trim().length > 0, t("completeness.checks.summary")],
    [doc.skills.length > 0, t("completeness.checks.skills")],
    [doc.experience.length > 0, t("completeness.checks.experience")],
    [doc.projects.some((p) => p.title.trim() || p.description.trim()), t("completeness.checks.projects")],
    [doc.education.some((e) => e.school.trim() || e.degree.trim()), t("completeness.checks.education")],
    [(doc.languages ?? []).filter((l) => l.name.trim()).length > 0, t("completeness.checks.languages")],
  ];
  const done = checks.filter(([ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  // Literal class strings (not template-interpolated) so Tailwind's static scanner picks all
  // three variants up at build time regardless of which branch actually runs.
  const tone =
    pct >= 85
      ? { text: "text-good", bar: "bg-good" }
      : pct >= 50
        ? { text: "text-signal", bar: "bg-star" }
        : { text: "text-rose-600", bar: "bg-rose-500" };
  const content = (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-ink">{t("completeness.title")}</span>
        <span className={`font-bold ${tone.text}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      {missing.length > 0 && <div className="text-[11px] text-ink-dim">{t("completeness.missingHint", { items: missing.join(", ") })}</div>}
    </>
  );
  if (bare) return <div className="space-y-1.5">{content}</div>;
  return <div className="rounded-xl border border-grid bg-surface px-3.5 py-2.5 space-y-1.5">{content}</div>;
}
