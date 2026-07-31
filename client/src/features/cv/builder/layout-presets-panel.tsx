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

/** Drag-and-drop CV section ordering and managing saved theme presets. */
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
      <Section title="Section order" icon="↕️">
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
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition-colors ${secDrag === i ? "border-signal/50 bg-signal/10/50" : "border-grid bg-surface-2"}`}
              >
                <span
                  draggable
                  onDragStart={() => setSecDrag(i)}
                  onDragEnd={() => setSecDrag(null)}
                  title="Drag to reorder"
                  className="cursor-grab active:cursor-grabbing select-none text-ink-dim hover:text-ink-dim"
                >
                  ⠿
                </span>
                <span className="text-ink">{label}</span>
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
        <div className="text-[11px] text-ink-dim">
          In "Two columns", Skills/Languages/Education go in the side column, the rest in the main one.
        </div>
      </Section>
      <Section title="Presets" icon="💾" hint={presets.length ? `${presets.length} saved` : undefined}>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-grid pl-2.5 pr-1 py-0.5 text-xs"
              >
                <button onClick={() => onApplyPreset(p)} className="text-ink hover:text-signal font-medium">
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.name)}
                  title="Delete"
                  className="text-ink-dim hover:text-rose-500 leading-none px-1"
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
            placeholder="e.g. My blue compact"
            className="flex-1 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <Btn size="sm" onClick={onSavePreset} loading={saving}>
            Save
          </Btn>
        </div>
        <div className="text-[11px] text-ink-dim">A preset remembers the template, color, font, scale, photo style, and section order.</div>
      </Section>
    </>
  );
}
