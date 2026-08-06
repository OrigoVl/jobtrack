import { useTranslation } from "react-i18next";
import { Field } from "../../../shared/view-kit";
import { Btn, Spinner } from "../../../shared/ui";
import type { CvContactLink, CvDoc } from "../../../shared/types";

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

interface ContactLinksEditorProps {
  links: CvContactLink[];
  onChange: (links: CvContactLink[]) => void;
}

/** Structured links (LinkedIn/GitHub/portfolio/etc.), each its own label+URL row — additive
 * alongside the freeform Contacts field above (which stays free text for email/phone), not a
 * replacement for it. Keeps a label as plain text rather than a fixed dropdown: a link genuinely
 * doesn't need to be one of a fixed set ("Blog", "Behance", "Stack Overflow" all just as valid). */
function ContactLinksEditor({ links, onChange }: ContactLinksEditorProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setLink = (i: number, p: Partial<CvContactLink>) => onChange(links.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-dim">{t("generalSection.links.title")}</span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...links, { label: "", url: "" }])}>
          {t("generalSection.links.addEntry")}
        </Btn>
      </div>
      {links.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="w-32">
            <Field
              label={t("generalSection.links.label")}
              value={l.label}
              onChange={(v) => setLink(i, { label: v })}
              placeholder={t("generalSection.links.labelPlaceholder")}
              maxLength={60}
            />
          </div>
          <div className="flex-1">
            <Field
              label={t("generalSection.links.url")}
              value={l.url}
              onChange={(v) => setLink(i, { url: v })}
              placeholder={t("generalSection.links.urlPlaceholder")}
              maxLength={300}
            />
          </div>
          <Btn size="sm" variant="danger" onClick={() => onChange(links.filter((_, idx) => idx !== i))}>
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}

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
      <ContactLinksEditor links={doc.links ?? []} onChange={(links) => onChange({ links })} />
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
            {busyStyle === style && <Spinner className="w-3 h-3" />} {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
