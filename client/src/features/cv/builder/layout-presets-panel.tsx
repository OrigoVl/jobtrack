import { useState } from "react";
import { Btn, Section } from "../../../shared/ui";
import type { CvPreset, CvSection } from "../../../shared/types";
import { SECTION_LABELS } from "./cv-doc-utils";

interface LayoutPresetsPanelProps {
  sectionOrder: CvSection[];
  onMoveSection: (from: number, to: number) => void;
  presets: CvPreset[];
  presetName: string;
  onPresetNameChange: (v: string) => void;
  onSavePreset: () => void;
  onApplyPreset: (p: CvPreset) => void;
  onDeletePreset: (name: string) => void;
  saving: boolean;
}

/** Драг-н-дроп порядку секцій CV та керування збереженими пресетами теми. */
export function LayoutPresetsPanel({
  sectionOrder,
  onMoveSection,
  presets,
  presetName,
  onPresetNameChange,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  saving,
}: LayoutPresetsPanelProps) {
  const [secDrag, setSecDrag] = useState<number | null>(null);
  return (
    <>
      <Section title="Порядок секцій" icon="↕️">
        <div className="flex flex-col gap-1">
          {sectionOrder.map((key, i) => {
            const label = SECTION_LABELS.find(([k]) => k === key)?.[1] ?? key;
            return (
              <div
                key={key}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={() => {
                  if (secDrag !== null) onMoveSection(secDrag, i);
                  setSecDrag(null);
                }}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition-colors ${secDrag === i ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 bg-slate-50"}`}
              >
                <span
                  draggable
                  onDragStart={() => setSecDrag(i)}
                  onDragEnd={() => setSecDrag(null)}
                  title="Перетягни, щоб змінити порядок"
                  className="cursor-grab active:cursor-grabbing select-none text-slate-400 hover:text-slate-600"
                >
                  ⠿
                </span>
                <span className="text-slate-700">{label}</span>
                <div className="ml-auto flex gap-1">
                  <Btn size="sm" variant="subtle" onClick={() => onMoveSection(i, i - 1)} disabled={i === 0}>
                    ↑
                  </Btn>
                  <Btn size="sm" variant="subtle" onClick={() => onMoveSection(i, i + 1)} disabled={i === sectionOrder.length - 1}>
                    ↓
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-slate-400">У «Двох колонках» Навички/Мови/Освіта — у бічній колонці, решта — в основній.</div>
      </Section>
      <Section title="Пресети" icon="💾" hint={presets.length ? `${presets.length} збережено` : undefined}>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 pl-2.5 pr-1 py-0.5 text-xs"
              >
                <button onClick={() => onApplyPreset(p)} className="text-slate-700 hover:text-indigo-600 font-medium">
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.name)}
                  title="Видалити"
                  className="text-slate-400 hover:text-rose-500 leading-none px-1"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={presetName}
            maxLength={40}
            onChange={(e) => onPresetNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSavePreset()}
            placeholder="напр. Мій синій компакт"
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <Btn size="sm" onClick={onSavePreset} disabled={saving}>
            {saving ? "…" : "Зберегти"}
          </Btn>
        </div>
        <div className="text-[11px] text-slate-400">Пресет запам'ятовує шаблон, колір, шрифт, масштаб, фото-стиль і порядок секцій.</div>
      </Section>
    </>
  );
}
