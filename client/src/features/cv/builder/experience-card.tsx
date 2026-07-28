import { useState } from "react";
import { Btn, Card } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import type { CvExperience } from "../../../shared/types";

interface ExperienceCardProps {
  experience: CvExperience[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onSet: (i: number, p: Partial<CvExperience>) => void;
  onMove: (from: number, to: number) => void;
  llm: boolean;
  busyKey: string;
  onImproveBullets: (i: number) => void;
}

/** A list of experience entries with drag-and-drop reordering and AI improvement of bullets. */
export function ExperienceCard({ experience, onAdd, onRemove, onSet, onMove, llm, busyKey, onImproveBullets }: ExperienceCardProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Experience</span>
        <Btn size="sm" variant="ghost" onClick={onAdd}>
          + Add
        </Btn>
      </div>
      {experience.map((e, i) => (
        <div
          key={i}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={() => {
            if (dragIdx !== null) onMove(dragIdx, i);
            setDragIdx(null);
          }}
          className={`rounded-lg border p-2.5 space-y-2 transition-colors ${dragIdx === i ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"}`}
        >
          <div className="flex items-center gap-2">
            <span
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragEnd={() => setDragIdx(null)}
              title="Drag to reorder"
              className="cursor-grab active:cursor-grabbing select-none text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              ⠿
            </span>
            <span className="text-xs text-slate-400">Entry {i + 1}</span>
            <div className="ml-auto flex gap-1">
              <Btn size="sm" variant="subtle" onClick={() => onMove(i, i - 1)} disabled={i === 0}>
                ↑
              </Btn>
              <Btn size="sm" variant="subtle" onClick={() => onMove(i, i + 1)} disabled={i === experience.length - 1}>
                ↓
              </Btn>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Role" value={e.role} onChange={(v) => onSet(i, { role: v })} maxLength={160} />
            <Field label="Company" value={e.company} onChange={(v) => onSet(i, { company: v })} maxLength={160} />
            <Field label="Period" value={e.period} onChange={(v) => onSet(i, { period: v })} placeholder="2022 — present" maxLength={60} />
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              Bullets (one per line)
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => onImproveBullets(i)}
                loading={busyKey === `b${i}`}
                disabled={!llm || e.bullets.filter(Boolean).length === 0}
              >
                ✨ result-focus
              </Btn>
            </span>
            <textarea
              value={e.bullets.join("\n")}
              onChange={(ev) => onSet(i, { bullets: ev.target.value.split("\n") })}
              className="w-full mt-0.5 h-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </label>
          <Btn size="sm" variant="danger" onClick={() => onRemove(i)}>
            Delete
          </Btn>
        </div>
      ))}
    </Card>
  );
}
