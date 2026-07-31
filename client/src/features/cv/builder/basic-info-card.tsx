import { Field } from "../../../shared/view-kit";
import type { CvDoc } from "../../../shared/types";

export type SummaryStyle = "improve" | "shorter" | "ats" | "technical" | "leadership";
const SUMMARY_CHIPS: [SummaryStyle, string][] = [
  ["improve", "✨ Improve"],
  ["shorter", "✂️ Shorter"],
  ["ats", "🎯 ATS"],
  ["technical", "🛠 Technical"],
  ["leadership", "🧭 Leadership"],
];

interface GeneralSectionProps {
  doc: CvDoc;
  onChange: (p: Partial<CvDoc>) => void;
  llm: boolean;
  busyStyle: SummaryStyle | "";
  onImproveSummary: (style: SummaryStyle) => void;
}

/** "General" accordion section: name, role, contacts, summary — with AI rewrite chips.
 * Skills live in their own section now (see the "Skills" accordion item in CvBuilder). */
export function GeneralSection({ doc, onChange, llm, busyStyle, onImproveSummary }: GeneralSectionProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" value={doc.name} onChange={(v) => onChange({ name: v })} placeholder="Michael Voloshyn" maxLength={120} />
        <Field
          label="Role / title"
          value={doc.title}
          onChange={(v) => onChange({ title: v })}
          placeholder="Full-Stack Developer"
          maxLength={160}
        />
      </div>
      <Field
        label="Contacts"
        value={doc.contact}
        onChange={(v) => onChange({ contact: v })}
        placeholder="email · LinkedIn · GitHub"
        maxLength={400}
      />
      <label className="block">
        <span className="text-xs font-semibold text-ink-dim">Summary</span>
        <textarea
          value={doc.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          className="w-full mt-0.5 h-20 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
      </label>
      {/* Small action chips instead of one "improve" button — each rewrites the summary with a
          different emphasis (kept short so the row never wraps awkwardly on a narrow column). */}
      <div className="flex flex-wrap gap-1.5">
        {SUMMARY_CHIPS.map(([style, label]) => (
          <button
            key={style}
            type="button"
            onClick={() => onImproveSummary(style)}
            disabled={!llm || !doc.summary.trim() || !!busyStyle}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-2 text-ink-dim border border-grid hover:bg-signal/10 hover:text-signal hover:border-signal/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busyStyle === style ? "⏳" : null} {label}
          </button>
        ))}
      </div>
    </div>
  );
}
