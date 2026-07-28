import type { CvDoc } from "../../../shared/types";

/** Small "how complete is this resume" widget — 7 binary checks (general info, summary, skills,
 * experience, projects, education, languages), shown as a % + progress bar + missing list.
 * Sits above the accordion nav so it's the first thing you see, not buried at the bottom. */
export function ResumeCompleteness({ doc }: { doc: CvDoc }) {
  const checks: [boolean, string][] = [
    [!!(doc.name.trim() && doc.title.trim() && doc.contact.trim()), "General info"],
    [doc.summary.trim().length > 0, "Summary"],
    [doc.skills.length > 0, "Skills"],
    [doc.experience.length > 0, "Experience"],
    [doc.projects.filter(Boolean).length > 0, "Projects"],
    [doc.education.filter(Boolean).length > 0, "Education"],
    [(doc.languages ?? []).filter((l) => l.name.trim()).length > 0, "Languages"],
  ];
  const done = checks.filter(([ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  // Literal class strings (not template-interpolated) so Tailwind's static scanner picks all
  // three variants up at build time regardless of which branch actually runs.
  const tone =
    pct >= 85
      ? { text: "text-emerald-600", bar: "bg-emerald-500" }
      : pct >= 50
        ? { text: "text-amber-600", bar: "bg-amber-500" }
        : { text: "text-rose-600", bar: "bg-rose-500" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">Resume completeness</span>
        <span className={`font-bold ${tone.text}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      {missing.length > 0 && <div className="text-[11px] text-slate-400">Missing: {missing.join(", ")}</div>}
    </div>
  );
}
