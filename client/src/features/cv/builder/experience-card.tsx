import { useState } from "react";
import { Btn, Collapse } from "../../../shared/ui";
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
  /** Externally requested entry to expand — e.g. clicking an entry in the live preview. */
  focusIndex?: number | null;
}

/** One collapsed row: "Company / Role / Period" plus a chevron — expands to the full edit form. */
export function ExperienceCard({
  experience,
  onAdd,
  onRemove,
  onSet,
  onMove,
  llm,
  busyKey,
  onImproveBullets,
  focusIndex,
}: ExperienceCardProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Only one entry expanded at a time — matches the accordion behavior of the rest of the
  // editor (avoids the old "wall of tall cards" scroll problem). New entries open immediately
  // so there's no extra click to start filling them in.
  const [expanded, setExpanded] = useState<number | null>(experience.length ? 0 : null);
  if (focusIndex != null && focusIndex !== expanded && focusIndex < experience.length) setExpanded(focusIndex);

  const add = () => {
    onAdd();
    setExpanded(experience.length); // the new entry is appended at the end
  };

  if (experience.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <div className="text-sm text-ink-dim">No experience entries yet</div>
        <Btn size="sm" onClick={add}>
          + Add experience
        </Btn>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Btn size="sm" variant="ghost" onClick={add}>
          + Add
        </Btn>
      </div>
      {experience.map((e, i) => {
        const isOpen = expanded === i;
        return (
          <div
            key={i}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null) onMove(dragIdx, i);
              setDragIdx(null);
            }}
            className={`rounded-lg border transition-colors ${dragIdx === i ? "border-signal/50 bg-signal/10/40" : isOpen ? "border-signal/30" : "border-grid"}`}
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 rounded-lg"
            >
              <button
                type="button"
                draggable
                onDragStart={(ev) => {
                  ev.stopPropagation();
                  setDragIdx(i);
                }}
                onDragEnd={() => setDragIdx(null)}
                onClick={(ev) => ev.stopPropagation()}
                title="Drag to reorder"
                className="cursor-grab active:cursor-grabbing select-none text-ink-dim hover:text-ink-dim text-lg leading-none"
              >
                ⠿
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink truncate">{e.company || `Entry ${i + 1}`}</div>
                <div className="text-xs text-ink-dim truncate">
                  {e.role || "No role"}
                  {e.period ? ` · ${e.period}` : ""}
                </div>
              </div>
              <span className={`text-ink-dim transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} aria-hidden>
                ›
              </span>
            </button>
            <Collapse open={isOpen}>
              <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-surface-2">
                <div className="flex gap-1 justify-end">
                  <Btn size="sm" variant="subtle" onClick={() => onMove(i, i - 1)} disabled={i === 0}>
                    ↑
                  </Btn>
                  <Btn size="sm" variant="subtle" onClick={() => onMove(i, i + 1)} disabled={i === experience.length - 1}>
                    ↓
                  </Btn>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Role" value={e.role} onChange={(v) => onSet(i, { role: v })} maxLength={160} />
                  <Field label="Company" value={e.company} onChange={(v) => onSet(i, { company: v })} maxLength={160} />
                  <Field
                    label="Period"
                    value={e.period}
                    onChange={(v) => onSet(i, { period: v })}
                    placeholder="2022 — present"
                    maxLength={60}
                  />
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-ink-dim flex items-center gap-2">
                    Achievements (one per line)
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
                    className="w-full mt-0.5 h-24 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                  />
                </label>
                <div className="flex justify-end">
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      onRemove(i);
                      setExpanded(null);
                    }}
                  >
                    Delete
                  </Btn>
                </div>
              </div>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}
