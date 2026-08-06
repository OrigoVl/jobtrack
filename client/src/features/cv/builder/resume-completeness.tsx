import { useTranslation } from "react-i18next";
import type { CvDoc } from "../../../shared/types";

/** Small "how complete is this resume" widget — 8 binary checks (general info, summary, skills,
 * experience, projects, education, certifications, languages), shown as a % + progress bar +
 * missing list. Sits above the accordion nav so it's the first thing you see, not buried at the
 * bottom. Deliberately does NOT track the newer optional sections (awards/publications/volunteer/
 * references) — most CVs legitimately have none of those, and counting them here would dilute the
 * score with noise instead of nudging toward what actually matters for most applications. */
export function ResumeCompleteness({ doc, bare = false }: { doc: CvDoc; bare?: boolean }) {
  const { t } = useTranslation(["cv", "common"]);
  const checks: [boolean, string][] = [
    [!!(doc.name.trim() && doc.title.trim() && doc.contact.trim()), t("completeness.checks.generalInfo")],
    [doc.summary.trim().length > 0, t("completeness.checks.summary")],
    [doc.skills.length > 0, t("completeness.checks.skills")],
    // Requires an actual bullet, not just a bare role/company row — an empty entry doesn't help
    // an ATS/AI parse pull out anything to match against a job posting.
    [doc.experience.some((e) => e.bullets.some((b) => b.trim())), t("completeness.checks.experience")],
    [doc.projects.some((p) => p.title.trim() || p.description.trim()), t("completeness.checks.projects")],
    [doc.education.some((e) => e.school.trim() || e.degree.trim()), t("completeness.checks.education")],
    [(doc.certifications ?? []).some((c) => c.name.trim()), t("completeness.checks.certifications")],
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
