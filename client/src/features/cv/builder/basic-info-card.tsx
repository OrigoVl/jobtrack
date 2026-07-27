import { Btn, Card } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type { CvDoc } from "../../../shared/types";

interface BasicInfoCardProps {
  doc: CvDoc;
  onChange: (p: Partial<CvDoc>) => void;
  llm: boolean;
  improvingSummary: boolean;
  onImproveSummary: () => void;
}

/** Ім'я, роль, контакти, підсумок (з AI-покращенням) і навички. */
export function BasicInfoCard({ doc, onChange, llm, improvingSummary, onImproveSummary }: BasicInfoCardProps) {
  return (
    <Card className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ім'я" value={doc.name} onChange={(v) => onChange({ name: v })} placeholder="Michael Voloshyn" maxLength={120} />
        <Field
          label="Роль / посада"
          value={doc.title}
          onChange={(v) => onChange({ title: v })}
          placeholder="Full-Stack Developer"
          maxLength={160}
        />
      </div>
      <Field
        label="Контакти"
        value={doc.contact}
        onChange={(v) => onChange({ contact: v })}
        placeholder="email · LinkedIn · GitHub"
        maxLength={400}
      />
      <label className="block">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          Підсумок (summary)
          <Btn size="sm" variant="ghost" onClick={onImproveSummary} disabled={improvingSummary || !llm || !doc.summary.trim()}>
            {improvingSummary ? "…" : "✨ покращити"}
          </Btn>
        </span>
        <textarea
          value={doc.summary}
          onChange={(e) => onChange({ summary: e.target.value })}
          className="w-full mt-0.5 h-20 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </label>
      <Field
        label="Навички (через кому)"
        value={doc.skills.join(", ")}
        onChange={(v) =>
          onChange({
            skills: v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />
    </Card>
  );
}
