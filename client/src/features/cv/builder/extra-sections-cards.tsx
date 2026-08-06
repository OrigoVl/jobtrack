import { useTranslation } from "react-i18next";
import { Btn, Select } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type { CvCertificationEntry, CvEducationEntry, CvLanguage, CvProjectEntry } from "../../../shared/types";

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native", "Conversational"];
// "Native"/"Conversational" are also the stored wire values (see CvLanguage.level) — only their
// DISPLAY label is translated here, same convention as shared/status-labels.ts's statusLabel.
const LANGUAGE_LEVEL_LABEL_KEY: Record<string, "extraSections.languages.native" | "extraSections.languages.conversational"> = {
  Native: "extraSections.languages.native",
  Conversational: "extraSections.languages.conversational",
};

interface ProjectsSectionProps {
  projects: CvProjectEntry[];
  onChange: (projects: CvProjectEntry[]) => void;
}

/** Projects — structured entries (title/description/tech/link), each in its own bordered block
 * (unlike Education's single row: a project's description needs real room, and cramming a
 * textarea into a row-per-entry layout like Education's would look unbalanced). Its own accordion
 * section (previously bundled with Education). */
export function ProjectsSection({ projects, onChange }: ProjectsSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvProjectEntry>) => onChange(projects.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {projects.length ? t("builder.sections.addedCount", { count: projects.length }) : t("extraSections.projects.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...projects, { title: "", description: "", tech: [], link: "" }])}>
          {t("extraSections.projects.addEntry")}
        </Btn>
      </div>
      {projects.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.projects.hint")}</div>}
      {projects.map((entry, i) => (
        <div key={i} className="rounded-lg border border-grid p-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Field
                label={t("extraSections.projects.title")}
                value={entry.title}
                onChange={(v) => setEntry(i, { title: v })}
                placeholder={t("extraSections.projects.titlePlaceholder")}
                maxLength={200}
              />
            </div>
            <Btn size="sm" variant="danger" className="mt-5" onClick={() => onChange(projects.filter((_, idx) => idx !== i))}>
              ✕
            </Btn>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("extraSections.projects.description")}</span>
            <textarea
              value={entry.description}
              onChange={(e) => setEntry(i, { description: e.target.value })}
              placeholder={t("extraSections.projects.descriptionPlaceholder")}
              className="w-full mt-0.5 h-16 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("extraSections.projects.tech")}
              value={entry.tech.join(", ")}
              onChange={(v) =>
                setEntry(i, {
                  tech: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={t("extraSections.projects.techPlaceholder")}
            />
            <Field
              label={t("extraSections.projects.link")}
              value={entry.link}
              onChange={(v) => setEntry(i, { link: v })}
              placeholder={t("extraSections.projects.linkPlaceholder")}
              maxLength={300}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EducationSectionProps {
  education: CvEducationEntry[];
  onChange: (education: CvEducationEntry[]) => void;
}

/** Education — structured entries (school/degree/period), one row per entry — its own accordion
 * section. Mirrors LanguagesSection's row-per-item pattern below rather than Experience's fuller
 * drag-reorder accordion: education entries are typically few (1-3) and don't need their own
 * expand/collapse or bullet list, just a handful of fields. */
export function EducationSection({ education, onChange }: EducationSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvEducationEntry>) => onChange(education.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {education.length ? t("builder.sections.addedCount", { count: education.length }) : t("extraSections.education.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...education, { school: "", degree: "", period: "" }])}>
          {t("extraSections.education.addEntry")}
        </Btn>
      </div>
      {education.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.education.hint")}</div>}
      {education.map((entry, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Field
              label={t("extraSections.education.school")}
              value={entry.school}
              onChange={(v) => setEntry(i, { school: v })}
              placeholder={t("extraSections.education.schoolPlaceholder")}
              maxLength={200}
            />
            <Field
              label={t("extraSections.education.degree")}
              value={entry.degree}
              onChange={(v) => setEntry(i, { degree: v })}
              placeholder={t("extraSections.education.degreePlaceholder")}
              maxLength={160}
            />
          </div>
          <div className="w-32">
            <Field
              label={t("extraSections.education.period")}
              value={entry.period}
              onChange={(v) => setEntry(i, { period: v })}
              placeholder={t("extraSections.education.periodPlaceholder")}
              maxLength={60}
            />
          </div>
          <Btn size="sm" variant="danger" onClick={() => onChange(education.filter((_, idx) => idx !== i))}>
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}

interface CertificationsSectionProps {
  certifications: CvCertificationEntry[];
  onChange: (certifications: CvCertificationEntry[]) => void;
}

/** Certifications/awards — structured entries (name/issuer/date), one row per entry. Same
 * row-per-item layout as Education (short fields, no room-hungry description needed). */
export function CertificationsSection({ certifications, onChange }: CertificationsSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvCertificationEntry>) =>
    onChange(certifications.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {certifications.length
            ? t("builder.sections.addedCount", { count: certifications.length })
            : t("extraSections.certifications.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...certifications, { name: "", issuer: "", date: "" }])}>
          {t("extraSections.certifications.addEntry")}
        </Btn>
      </div>
      {certifications.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.certifications.hint")}</div>}
      {certifications.map((entry, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Field
              label={t("extraSections.certifications.name")}
              value={entry.name}
              onChange={(v) => setEntry(i, { name: v })}
              placeholder={t("extraSections.certifications.namePlaceholder")}
              maxLength={200}
            />
            <Field
              label={t("extraSections.certifications.issuer")}
              value={entry.issuer}
              onChange={(v) => setEntry(i, { issuer: v })}
              placeholder={t("extraSections.certifications.issuerPlaceholder")}
              maxLength={160}
            />
          </div>
          <div className="w-32">
            <Field
              label={t("extraSections.certifications.date")}
              value={entry.date}
              onChange={(v) => setEntry(i, { date: v })}
              placeholder={t("extraSections.certifications.datePlaceholder")}
              maxLength={60}
            />
          </div>
          <Btn size="sm" variant="danger" onClick={() => onChange(certifications.filter((_, idx) => idx !== i))}>
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}

interface LanguagesSectionProps {
  languages: CvLanguage[];
  onChange: (languages: CvLanguage[]) => void;
}

/** Languages and proficiency level — a separate accordion section. */
export function LanguagesSection({ languages, onChange }: LanguagesSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setLang = (i: number, p: Partial<CvLanguage>) => onChange(languages.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {languages.length ? t("builder.sections.addedCount", { count: languages.length }) : t("extraSections.languages.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...languages, { name: "", level: "B2" }])}>
          {t("extraSections.languages.addLanguage")}
        </Btn>
      </div>
      {languages.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.languages.hint")}</div>}
      {languages.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label={t("extraSections.languages.languageN", { n: i + 1 })}
              value={l.name}
              onChange={(v) => setLang(i, { name: v })}
              placeholder={t("extraSections.languages.namePlaceholder")}
              maxLength={60}
            />
          </div>
          <label className="block w-40">
            <span className="text-xs font-semibold text-ink-dim">{t("extraSections.languages.level")}</span>
            <Select value={l.level} onChange={(e) => setLang(i, { level: e.target.value })} className="w-full mt-0.5">
              {LANGUAGE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {LANGUAGE_LEVEL_LABEL_KEY[lvl] ? t(LANGUAGE_LEVEL_LABEL_KEY[lvl]) : lvl}
                </option>
              ))}
            </Select>
          </label>
          <Btn size="sm" variant="danger" onClick={() => onChange(languages.filter((_, idx) => idx !== i))}>
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}
