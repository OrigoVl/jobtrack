import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Section } from "../../../shared/ui";
import { ArrowsUpDownIcon } from "../../../shared/icons";
import type { CvPreset, CvSection } from "../../../shared/types";

// Local translation-key map for the section-order UI's display labels — deliberately NOT
// reusing cv-doc-utils.ts's SECTION_LABELS: that array feeds the actual exported/shared CV
// document's headings, which must always stay in the CV's own language, never the app's UI
// language (see cv-doc-utils.ts's doc comment). This editor chrome list needs its own i18n-aware
// labels instead.
const SECTION_LABEL_KEY: Record<
  CvSection,
  | "layoutPresets.sections.summary"
  | "layoutPresets.sections.skills"
  | "layoutPresets.sections.experience"
  | "layoutPresets.sections.projects"
  | "layoutPresets.sections.education"
  | "layoutPresets.sections.certifications"
  | "layoutPresets.sections.languages"
  | "layoutPresets.sections.awards"
  | "layoutPresets.sections.publications"
  | "layoutPresets.sections.volunteer"
  | "layoutPresets.sections.references"
> = {
  summary: "layoutPresets.sections.summary",
  skills: "layoutPresets.sections.skills",
  experience: "layoutPresets.sections.experience",
  projects: "layoutPresets.sections.projects",
  education: "layoutPresets.sections.education",
  certifications: "layoutPresets.sections.certifications",
  languages: "layoutPresets.sections.languages",
  awards: "layoutPresets.sections.awards",
  publications: "layoutPresets.sections.publications",
  volunteer: "layoutPresets.sections.volunteer",
  references: "layoutPresets.sections.references",
};

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
  const { t } = useTranslation(["cv", "common"]);
  const [secDrag, setSecDrag] = useState<number | null>(null);
  return (
    <>
      <Section title={t("layoutPresets.order.title")} icon={<ArrowsUpDownIcon className="h-4 w-4" />}>
        <div className="flex flex-col gap-1">
          {sectionOrder.map((key, i) => {
            const label = t(SECTION_LABEL_KEY[key]);
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
                  title={t("experienceCard.dragToReorder")}
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
        <div className="text-[11px] text-ink-dim">{t("layoutPresets.order.twoColHint")}</div>
      </Section>
      <Section
        title={t("layoutPresets.presets.title")}
        hint={presets.length ? t("layoutPresets.presets.savedCount", { count: presets.length }) : undefined}
      >
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
                  title={t("common:actions.delete")}
                  aria-label={`${t("common:actions.delete")}: ${p.name}`}
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
            placeholder={t("layoutPresets.presets.namePlaceholder")}
            className="flex-1 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <Btn size="sm" onClick={onSavePreset} loading={saving}>
            {t("common:actions.save")}
          </Btn>
        </div>
        <div className="text-[11px] text-ink-dim">{t("layoutPresets.presets.hint")}</div>
      </Section>
    </>
  );
}
