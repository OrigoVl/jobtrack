import { useTranslation } from "react-i18next";
import { Field } from "../../../shared/view-kit";
import type { CvDoc } from "../../../shared/types";

export type SummaryStyle = "improve" | "shorter" | "ats" | "technical" | "leadership";
const SUMMARY_CHIP_KEYS: [
  SummaryStyle,
  (
    | "generalSection.summaryChips.improve"
    | "generalSection.summaryChips.shorter"
    | "generalSection.summaryChips.ats"
    | "generalSection.summaryChips.technical"
    | "generalSection.summaryChips.leadership"
  ),
][] = [
  ["improve", "generalSection.summaryChips.improve"],
  ["shorter", "generalSection.summaryChips.shorter"],
  ["ats", "generalSection.summaryChips.ats"],
  ["technical", "generalSection.summaryChips.technical"],
  ["leadership", "generalSection.summaryChips.leadership"],
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
  const { t } = useTranslation(["cv", "common"]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field
          label={t("generalSection.name")}
          value={doc.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="Michael Voloshyn"
          maxLength={120}
        />
        <Field
          label={t("generalSection.roleTitle")}
          value={doc.title}
          onChange={(v) => onChange({ title: v })}
          placeholder={t("generalSection.rolePlaceholder")}
          maxLength={160}
        />
      </div>
      <Field
        label={t("generalSection.contacts")}
        value={doc.contact}
        onChange={(v) => onChange({ contact: v })}
        placeholder={t("generalSection.contactsPlaceholder")}
        maxLength={400}
      />
      <label className="block">
        <span className="text-xs font-semibold text-ink-dim">{t("generalSection.summary")}</span>
        <textarea
          value={doc.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          className="w-full mt-0.5 h-20 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
      </label>
      {/* Small action chips instead of one "improve" button — each rewrites the summary with a
          different emphasis (kept short so the row never wraps awkwardly on a narrow column). */}
      <div className="flex flex-wrap gap-1.5">
        {SUMMARY_CHIP_KEYS.map(([style, labelKey]) => (
          <button
            key={style}
            type="button"
            onClick={() => onImproveSummary(style)}
            disabled={!llm || !doc.summary.trim() || !!busyStyle}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-2 text-ink-dim border border-grid hover:bg-signal/10 hover:text-signal hover:border-signal/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busyStyle === style ? "⏳" : null} {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
