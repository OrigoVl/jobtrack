import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Collapse } from "../../../shared/ui";
import { Field } from "../../../shared/view-kit";
import { SparkleIcon } from "../../../shared/icons";
import type { CvExperience } from "../../../shared/types";

/** Moves `arr[from]` to index `to`; a no-op (returns the same array reference) at either edge —
 * lets callers wire it straight to a disabled-at-the-edge button without their own bounds check. */
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface ExperienceCardProps {
  experience: CvExperience[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onSet: (i: number, p: Partial<CvExperience>) => void;
  onMove: (from: number, to: number) => void;
  llm: boolean;
  busyKey: string;
  onImproveBullets: (i: number) => void;
  /** Improves a single bullet (`busyKey` for this one is `` `bi${i}-${bulletIndex}` ``, distinct
   * from `onImproveBullets`' whole-entry `` `b${i}` `` so the two loading states never collide). */
  onImproveBullet: (i: number, bulletIndex: number) => void;
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
  onImproveBullet,
  focusIndex,
}: ExperienceCardProps) {
  const { t } = useTranslation(["cv", "common"]);
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
        <div className="text-sm text-ink-dim">{t("experienceCard.empty")}</div>
        <Btn size="sm" onClick={add}>
          {t("experienceCard.addFirst")}
        </Btn>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Btn size="sm" variant="ghost" onClick={add}>
          {t("experienceCard.add")}
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
                title={t("experienceCard.dragToReorder")}
                aria-label={t("experienceCard.dragToReorder")}
                className="cursor-grab active:cursor-grabbing select-none text-ink-dim hover:text-ink-dim text-lg leading-none"
              >
                ⠿
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink truncate">
                  {e.company || t("experienceCard.entryFallback", { n: i + 1 })}
                </div>
                <div className="text-xs text-ink-dim truncate">
                  {e.role || t("experienceCard.noRole")}
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
                  <Btn
                    size="sm"
                    variant="subtle"
                    onClick={() => onMove(i, i - 1)}
                    disabled={i === 0}
                    aria-label={t("experienceCard.moveUp")}
                    title={t("experienceCard.moveUp")}
                  >
                    ↑
                  </Btn>
                  <Btn
                    size="sm"
                    variant="subtle"
                    onClick={() => onMove(i, i + 1)}
                    disabled={i === experience.length - 1}
                    aria-label={t("experienceCard.moveDown")}
                    title={t("experienceCard.moveDown")}
                  >
                    ↓
                  </Btn>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label={t("experienceCard.role")} value={e.role} onChange={(v) => onSet(i, { role: v })} maxLength={160} />
                  <Field label={t("experienceCard.company")} value={e.company} onChange={(v) => onSet(i, { company: v })} maxLength={160} />
                  <Field
                    label={t("experienceCard.period")}
                    value={e.period}
                    onChange={(v) => onSet(i, { period: v })}
                    placeholder={t("experienceCard.periodPlaceholder")}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-dim">{t("experienceCard.achievements")}</span>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => onImproveBullets(i)}
                      loading={busyKey === `b${i}`}
                      disabled={!llm || e.bullets.filter(Boolean).length === 0}
                    >
                      {t("experienceCard.resultFocus")}
                    </Btn>
                  </div>
                  {/* One row per bullet (not a single \n-joined textarea) — each has its own
                      reorder/AI-improve/delete, and an accidental blank line can no longer create
                      a phantom empty bullet the way splitting a textarea's raw text on "\n" could. */}
                  {e.bullets.map((bullet, bi) => (
                    <div key={bi} className="flex items-start gap-1">
                      <div className="flex flex-col shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onSet(i, { bullets: moveItem(e.bullets, bi, bi - 1) })}
                          disabled={bi === 0}
                          aria-label={t("experienceCard.moveBulletUp")}
                          title={t("experienceCard.moveBulletUp")}
                          className="text-ink-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed leading-none text-[9px] px-0.5"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => onSet(i, { bullets: moveItem(e.bullets, bi, bi + 1) })}
                          disabled={bi === e.bullets.length - 1}
                          aria-label={t("experienceCard.moveBulletDown")}
                          title={t("experienceCard.moveBulletDown")}
                          className="text-ink-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed leading-none text-[9px] px-0.5"
                        >
                          ▼
                        </button>
                      </div>
                      <textarea
                        value={bullet}
                        onChange={(ev) => onSet(i, { bullets: e.bullets.map((b, idx) => (idx === bi ? ev.target.value : b)) })}
                        placeholder={t("experienceCard.bulletPlaceholder")}
                        rows={1}
                        className="flex-1 min-w-0 bg-surface-2 border border-grid rounded-lg p-1.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-signal/50"
                      />
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => onImproveBullet(i, bi)}
                        loading={busyKey === `bi${i}-${bi}`}
                        disabled={!llm || !bullet.trim()}
                        title={t("experienceCard.improveBulletTitle")}
                        aria-label={t("experienceCard.improveBulletTitle")}
                      >
                        <SparkleIcon className="w-3.5 h-3.5" />
                      </Btn>
                      <Btn
                        size="sm"
                        variant="danger"
                        onClick={() => onSet(i, { bullets: e.bullets.filter((_, idx) => idx !== bi) })}
                        aria-label={t("experienceCard.removeBulletAria")}
                        title={t("experienceCard.removeBulletAria")}
                      >
                        ✕
                      </Btn>
                    </div>
                  ))}
                  <Btn size="sm" variant="ghost" onClick={() => onSet(i, { bullets: [...e.bullets, ""] })}>
                    {t("experienceCard.addBullet")}
                  </Btn>
                </div>
                <div className="flex justify-end">
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      onRemove(i);
                      setExpanded(null);
                    }}
                  >
                    {t("common:actions.delete")}
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
