import { useTranslation } from "react-i18next";
import { Btn } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type { CvLanguage } from "../../../shared/types";

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native", "Conversational"];
// "Native"/"Conversational" are also the stored wire values (see CvLanguage.level) — only their
// DISPLAY label is translated here, same convention as shared/status-labels.ts's statusLabel.
const LANGUAGE_LEVEL_LABEL_KEY: Record<string, "extraSections.languages.native" | "extraSections.languages.conversational"> = {
  Native: "extraSections.languages.native",
  Conversational: "extraSections.languages.conversational",
};

/** Projects — one item per line. Its own accordion section (previously bundled with Education). */
export function ProjectsSection({ projects, onChange }: { projects: string[]; onChange: (v: string) => void }) {
  const { t } = useTranslation(["cv", "common"]);
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-dim">{t("extraSections.projects.label")}</span>
      <textarea
        value={projects.join("\n")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 h-24 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
      />
    </label>
  );
}

/** Education — one item per line. Its own accordion section. */
export function EducationSection({ education, onChange }: { education: string[]; onChange: (v: string) => void }) {
  const { t } = useTranslation(["cv", "common"]);
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-dim">{t("extraSections.education.label")}</span>
      <textarea
        value={education.join("\n")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 h-24 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
      />
    </label>
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
            <select
              value={l.level}
              onChange={(e) => setLang(i, { level: e.target.value })}
              className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            >
              {LANGUAGE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {LANGUAGE_LEVEL_LABEL_KEY[lvl] ? t(LANGUAGE_LEVEL_LABEL_KEY[lvl]) : lvl}
                </option>
              ))}
            </select>
          </label>
          <Btn size="sm" variant="danger" onClick={() => onChange(languages.filter((_, idx) => idx !== i))}>
            ✕
          </Btn>
        </div>
      ))}
    </div>
  );
}
