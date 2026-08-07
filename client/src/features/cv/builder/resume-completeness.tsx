import { useTranslation } from "react-i18next";
import type { CvDoc } from "../../../shared/types";

/** Editor section each completeness check maps to — lets the missing-items list double as a
 * "take me there" nav (see `onJump` below) instead of only naming what's absent. */
export type CompletenessTarget = "general" | "skills" | "experience" | "projects" | "education" | "certifications" | "languages";

/** Small "how complete is this resume" widget — 8 binary checks (general info, summary, skills,
 * experience, projects, education, certifications, languages), shown as a % + progress bar +
 * missing list. Sits above the accordion nav so it's the first thing you see, not buried at the
 * bottom. Deliberately does NOT track the newer optional sections (awards/publications/volunteer/
 * references) — most CVs legitimately have none of those, and counting them here would dilute the
 * score with noise instead of nudging toward what actually matters for most applications.
 *
 * When `onJump` is passed (the CV Builder), each missing item renders as a button that opens the
 * section it belongs to — the widget stops being a read-only verdict and becomes the page's
 * "what to do next" control. Without it (the Dashboard's read-only `bare` card) the same items
 * render as one plain sentence, exactly as before. */
export function ResumeCompleteness({
  doc,
  bare = false,
  onJump,
}: {
  doc: CvDoc;
  bare?: boolean;
  onJump?: (target: CompletenessTarget) => void;
}) {
  const { t } = useTranslation(["cv", "common"]);
  const checks: [boolean, string, CompletenessTarget][] = [
    [!!(doc.name.trim() && doc.title.trim() && doc.contact.trim()), t("completeness.checks.generalInfo"), "general"],
    [doc.summary.trim().length > 0, t("completeness.checks.summary"), "general"],
    [doc.skills.length > 0, t("completeness.checks.skills"), "skills"],
    // Requires an actual bullet, not just a bare role/company row — an empty entry doesn't help
    // an ATS/AI parse pull out anything to match against a job posting.
    [doc.experience.some((e) => e.bullets.some((b) => b.trim())), t("completeness.checks.experience"), "experience"],
    [doc.projects.some((p) => p.title.trim() || p.description.trim()), t("completeness.checks.projects"), "projects"],
    [doc.education.some((e) => e.school.trim() || e.degree.trim()), t("completeness.checks.education"), "education"],
    [(doc.certifications ?? []).some((c) => c.name.trim()), t("completeness.checks.certifications"), "certifications"],
    [(doc.languages ?? []).filter((l) => l.name.trim()).length > 0, t("completeness.checks.languages"), "languages"],
  ];
  const done = checks.filter(([ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter(([ok]) => !ok);
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
      {missing.length > 0 &&
        (onJump ? (
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-dim">
            <span>{t("completeness.missingLabel")}</span>
            {missing.map(([, label, target]) => (
              <button
                key={label}
                type="button"
                // The visible text is just the section name, which on its own would be an
                // ambiguous accessible name — identical to that section's own accordion header
                // further down the same column. The label says what pressing it actually does.
                aria-label={t("completeness.jumpAria", { section: label })}
                onClick={() => onJump(target)}
                className="rounded-full border border-grid bg-surface-2 px-2 py-0.5 font-medium text-ink-dim transition-colors hover:border-signal/40 hover:bg-signal/10 hover:text-signal focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-ink-dim">
            {t("completeness.missingHint", { items: missing.map(([, label]) => label).join(", ") })}
          </div>
        ))}
    </>
  );
  if (bare) return <div className="space-y-1.5">{content}</div>;
  return <div className="rounded-xl border border-grid bg-surface px-3.5 py-2.5 space-y-1.5">{content}</div>;
}
