import { useTranslation } from "react-i18next";
import { Btn, Select } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type {
  CvAwardEntry,
  CvCertificationEntry,
  CvEducationEntry,
  CvLanguage,
  CvProjectEntry,
  CvPublicationEntry,
  CvReferenceEntry,
  CvVolunteerEntry,
} from "../../../shared/types";

// "Conversational" used to be offered here too, alongside the letter scale — dropped from the
// picker since it roughly duplicates B1 and mixing a named tier into an otherwise all-letter
// scale read as inconsistent. Its label mapping below stays so CVs saved with that value before
// this change still render correctly; it just isn't offered for new entries.
const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
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
            <Btn
              size="sm"
              variant="danger"
              className="mt-[26px] w-[38px] h-[38px] shrink-0"
              onClick={() => onChange(projects.filter((_, idx) => idx !== i))}
            >
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
        <div key={i} className="flex items-start gap-2">
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
          <Btn
            size="sm"
            variant="danger"
            className="mt-[26px] w-[38px] h-[38px] shrink-0"
            onClick={() => onChange(education.filter((_, idx) => idx !== i))}
          >
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
        <div key={i} className="flex items-start gap-2">
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
          <Btn
            size="sm"
            variant="danger"
            className="mt-[26px] w-[38px] h-[38px] shrink-0"
            onClick={() => onChange(certifications.filter((_, idx) => idx !== i))}
          >
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
        <div key={i} className="flex items-start gap-2">
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
              {/* A CV saved before "Conversational" was dropped from the picker can still have it
                  as its stored level — keep it selectable here so the dropdown shows the real
                  saved value instead of silently falling back to whatever option is first. */}
              {(LANGUAGE_LEVELS.includes(l.level) ? LANGUAGE_LEVELS : [l.level, ...LANGUAGE_LEVELS]).map((lvl) => (
                <option key={lvl} value={lvl}>
                  {LANGUAGE_LEVEL_LABEL_KEY[lvl] ? t(LANGUAGE_LEVEL_LABEL_KEY[lvl]) : lvl}
                </option>
              ))}
            </Select>
          </label>
          <Btn
            size="sm"
            variant="danger"
            className="mt-[26px] w-[38px] h-[38px] shrink-0"
            onClick={() => onChange(languages.filter((_, idx) => idx !== i))}
          >
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}

interface AwardsSectionProps {
  awards: CvAwardEntry[];
  onChange: (awards: CvAwardEntry[]) => void;
}

/** Awards/honors — structured entries (title/issuer/date), one row per entry. Same row-per-item
 * layout as Certifications: a distinct section (an award isn't a credential), same shape. */
export function AwardsSection({ awards, onChange }: AwardsSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvAwardEntry>) => onChange(awards.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {awards.length ? t("builder.sections.addedCount", { count: awards.length }) : t("extraSections.awards.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...awards, { title: "", issuer: "", date: "" }])}>
          {t("extraSections.awards.addEntry")}
        </Btn>
      </div>
      {awards.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.awards.hint")}</div>}
      {awards.map((entry, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Field
              label={t("extraSections.awards.title")}
              value={entry.title}
              onChange={(v) => setEntry(i, { title: v })}
              placeholder={t("extraSections.awards.titlePlaceholder")}
              maxLength={200}
            />
            <Field
              label={t("extraSections.awards.issuer")}
              value={entry.issuer}
              onChange={(v) => setEntry(i, { issuer: v })}
              placeholder={t("extraSections.awards.issuerPlaceholder")}
              maxLength={160}
            />
          </div>
          <div className="w-32">
            <Field
              label={t("extraSections.awards.date")}
              value={entry.date}
              onChange={(v) => setEntry(i, { date: v })}
              placeholder={t("extraSections.awards.datePlaceholder")}
              maxLength={60}
            />
          </div>
          <Btn
            size="sm"
            variant="danger"
            className="mt-[26px] w-[38px] h-[38px] shrink-0"
            onClick={() => onChange(awards.filter((_, idx) => idx !== i))}
          >
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}

interface PublicationsSectionProps {
  publications: CvPublicationEntry[];
  onChange: (publications: CvPublicationEntry[]) => void;
}

/** Publications — structured entries (title/publisher/date/url), each in its own bordered block
 * (mirrors Projects: 4 fields need more room than a single row comfortably gives). */
export function PublicationsSection({ publications, onChange }: PublicationsSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvPublicationEntry>) => onChange(publications.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {publications.length ? t("builder.sections.addedCount", { count: publications.length }) : t("extraSections.publications.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...publications, { title: "", publisher: "", date: "", url: "" }])}>
          {t("extraSections.publications.addEntry")}
        </Btn>
      </div>
      {publications.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.publications.hint")}</div>}
      {publications.map((entry, i) => (
        <div key={i} className="rounded-lg border border-grid p-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Field
                label={t("extraSections.publications.title")}
                value={entry.title}
                onChange={(v) => setEntry(i, { title: v })}
                placeholder={t("extraSections.publications.titlePlaceholder")}
                maxLength={200}
              />
            </div>
            <Btn
              size="sm"
              variant="danger"
              className="mt-[26px] w-[38px] h-[38px] shrink-0"
              onClick={() => onChange(publications.filter((_, idx) => idx !== i))}
            >
              ✕
            </Btn>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("extraSections.publications.publisher")}
              value={entry.publisher}
              onChange={(v) => setEntry(i, { publisher: v })}
              placeholder={t("extraSections.publications.publisherPlaceholder")}
              maxLength={160}
            />
            <Field
              label={t("extraSections.publications.date")}
              value={entry.date}
              onChange={(v) => setEntry(i, { date: v })}
              placeholder={t("extraSections.publications.datePlaceholder")}
              maxLength={60}
            />
          </div>
          <Field
            label={t("extraSections.publications.url")}
            value={entry.url}
            onChange={(v) => setEntry(i, { url: v })}
            placeholder={t("extraSections.publications.urlPlaceholder")}
            maxLength={300}
          />
        </div>
      ))}
    </div>
  );
}

interface VolunteerSectionProps {
  volunteer: CvVolunteerEntry[];
  onChange: (volunteer: CvVolunteerEntry[]) => void;
}

/** Volunteer experience — structured entries (role/organization/period/description), each in its
 * own bordered block. Mirrors Projects' layout, not Experience's fuller bullet-list/drag-reorder
 * accordion — a volunteer entry is usually one role and one short blurb, not a multi-bullet job. */
export function VolunteerSection({ volunteer, onChange }: VolunteerSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvVolunteerEntry>) => onChange(volunteer.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {volunteer.length ? t("builder.sections.addedCount", { count: volunteer.length }) : t("extraSections.volunteer.noneYet")}
        </span>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => onChange([...volunteer, { role: "", organization: "", period: "", description: "" }])}
        >
          {t("extraSections.volunteer.addEntry")}
        </Btn>
      </div>
      {volunteer.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.volunteer.hint")}</div>}
      {volunteer.map((entry, i) => (
        <div key={i} className="rounded-lg border border-grid p-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Field
                label={t("extraSections.volunteer.role")}
                value={entry.role}
                onChange={(v) => setEntry(i, { role: v })}
                placeholder={t("extraSections.volunteer.rolePlaceholder")}
                maxLength={160}
              />
              <Field
                label={t("extraSections.volunteer.organization")}
                value={entry.organization}
                onChange={(v) => setEntry(i, { organization: v })}
                placeholder={t("extraSections.volunteer.organizationPlaceholder")}
                maxLength={160}
              />
            </div>
            <Btn
              size="sm"
              variant="danger"
              className="mt-[26px] w-[38px] h-[38px] shrink-0"
              onClick={() => onChange(volunteer.filter((_, idx) => idx !== i))}
            >
              ✕
            </Btn>
          </div>
          <div className="w-32">
            <Field
              label={t("extraSections.volunteer.period")}
              value={entry.period}
              onChange={(v) => setEntry(i, { period: v })}
              placeholder={t("extraSections.volunteer.periodPlaceholder")}
              maxLength={60}
            />
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink-dim">{t("extraSections.volunteer.description")}</span>
            <textarea
              value={entry.description}
              onChange={(e) => setEntry(i, { description: e.target.value })}
              placeholder={t("extraSections.volunteer.descriptionPlaceholder")}
              className="w-full mt-0.5 h-16 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </label>
        </div>
      ))}
    </div>
  );
}

interface ReferencesSectionProps {
  references: CvReferenceEntry[];
  onChange: (references: CvReferenceEntry[]) => void;
}

/** References — structured entries (name/relation/contact), one row per entry. Same row-per-item
 * layout as Certifications: a short, compact list rather than full visual entries. */
export function ReferencesSection({ references, onChange }: ReferencesSectionProps) {
  const { t } = useTranslation(["cv", "common"]);
  const setEntry = (i: number, p: Partial<CvReferenceEntry>) => onChange(references.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-dim">
          {references.length ? t("builder.sections.addedCount", { count: references.length }) : t("extraSections.references.noneYet")}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...references, { name: "", relation: "", contact: "" }])}>
          {t("extraSections.references.addEntry")}
        </Btn>
      </div>
      {references.length === 0 && <div className="text-xs text-ink-dim">{t("extraSections.references.hint")}</div>}
      {references.map((entry, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Field
              label={t("extraSections.references.name")}
              value={entry.name}
              onChange={(v) => setEntry(i, { name: v })}
              placeholder={t("extraSections.references.namePlaceholder")}
              maxLength={160}
            />
            <Field
              label={t("extraSections.references.relation")}
              value={entry.relation}
              onChange={(v) => setEntry(i, { relation: v })}
              placeholder={t("extraSections.references.relationPlaceholder")}
              maxLength={160}
            />
          </div>
          <div className="w-44">
            <Field
              label={t("extraSections.references.contact")}
              value={entry.contact}
              onChange={(v) => setEntry(i, { contact: v })}
              placeholder={t("extraSections.references.contactPlaceholder")}
              maxLength={200}
            />
          </div>
          <Btn
            size="sm"
            variant="danger"
            className="mt-[26px] w-[38px] h-[38px] shrink-0"
            onClick={() => onChange(references.filter((_, idx) => idx !== i))}
          >
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}
