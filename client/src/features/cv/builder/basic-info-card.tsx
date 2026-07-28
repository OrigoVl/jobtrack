import { Btn, Card } from "../../../shared/ui";
import { Field, SkillsInput } from "../../../shared/view-kit";
import type { CvDoc } from "../../../shared/types";

interface BasicInfoCardProps {
  doc: CvDoc;
  onChange: (p: Partial<CvDoc>) => void;
  llm: boolean;
  improvingSummary: boolean;
  onImproveSummary: () => void;
}

/** Name, role, contacts, summary (with AI improvement), and skills. */
export function BasicInfoCard({ doc, onChange, llm, improvingSummary, onImproveSummary }: BasicInfoCardProps) {
  return (
    <Card className="space-y-2">
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
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          Summary
          <Btn size="sm" variant="ghost" onClick={onImproveSummary} loading={improvingSummary} disabled={!llm || !doc.summary.trim()}>
            ✨ improve
          </Btn>
        </span>
        <textarea
          value={doc.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          className="w-full mt-0.5 h-20 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </label>
      <SkillsInput label="Skills" skills={doc.skills} onChange={(skills) => onChange({ skills })} placeholder="React, Node, TypeScript…" />
    </Card>
  );
}
