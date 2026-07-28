import { Btn, Card } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type { CvLanguage } from "../../../shared/types";

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native", "Conversational"];

interface ProjectsEducationCardProps {
  projects: string[];
  education: string[];
  onChangeProjects: (v: string) => void;
  onChangeEducation: (v: string) => void;
}

/** Projects and education — simple text lists (one item per line). */
export function ProjectsEducationCard({ projects, education, onChangeProjects, onChangeEducation }: ProjectsEducationCardProps) {
  return (
    <Card className="space-y-2">
      <label className="block">
        <span className="text-xs font-semibold text-slate-500">Projects (one per line)</span>
        <textarea
          value={projects.join("\n")}
          onChange={(e) => onChangeProjects(e.target.value)}
          className="w-full mt-0.5 h-16 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-slate-500">Education (one per line)</span>
        <textarea
          value={education.join("\n")}
          onChange={(e) => onChangeEducation(e.target.value)}
          className="w-full mt-0.5 h-16 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </label>
    </Card>
  );
}

interface LanguagesCardProps {
  languages: CvLanguage[];
  onChange: (languages: CvLanguage[]) => void;
}

/** Languages and proficiency level — a separate section in the CV. */
export function LanguagesCard({ languages, onChange }: LanguagesCardProps) {
  const setLang = (i: number, p: Partial<CvLanguage>) => onChange(languages.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Languages</span>
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
    </Card>
  );
}
