import { Btn } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type { CvLanguage } from "../../../shared/types";

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native", "Conversational"];

/** Projects — one item per line. Its own accordion section (previously bundled with Education). */
export function ProjectsSection({ projects, onChange }: { projects: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">Projects (one per line)</span>
      <textarea
        value={projects.join("\n")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 h-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </label>
  );
}

/** Education — one item per line. Its own accordion section. */
export function EducationSection({ education, onChange }: { education: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">Education (one per line)</span>
      <textarea
        value={education.join("\n")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 h-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
  const setLang = (i: number, p: Partial<CvLanguage>) => onChange(languages.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{languages.length ? `${languages.length} added` : "None yet"}</span>
        <Btn size="sm" variant="ghost" onClick={() => onChange([...languages, { name: "", level: "B2" }])}>
          + Add a language
        </Btn>
      </div>
      {languages.length === 0 && (
        <div className="text-xs text-slate-400">Add languages and proficiency level — they'll show up as a separate section in the CV.</div>
      )}
      {languages.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label={`Language ${i + 1}`}
              value={l.name}
              onChange={(v) => setLang(i, { name: v })}
              placeholder="English"
              maxLength={60}
            />
          </div>
          <label className="block w-40">
            <span className="text-xs font-semibold text-slate-500">Level</span>
            <select
              value={l.level}
              onChange={(e) => setLang(i, { level: e.target.value })}
              className="w-full mt-0.5 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {LANGUAGE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
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
