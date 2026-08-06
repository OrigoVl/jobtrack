import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateVacancy, useVacancies } from "../../shared/queries";
import { Chip, Dropdown, Spinner } from "../../shared/ui";
import { STATUSES, type Vacancy } from "../../shared/types";
import { fitTone, fitLabel } from "../../shared/fit-tone";
import { statusLabel } from "../../shared/status-labels";
import { STATUS_DOT_CLASS, STATUS_BORDER_L_CLASS, DEFAULT_STATUS_DOT_CLASS, DEFAULT_STATUS_BORDER_L_CLASS } from "../../shared/status-tone";
import { SimilarVacanciesButton } from "./similar-vacancies-button";

/* ---------- Vacancies board (drag-and-drop + keyboard) ---------- */
export function VacancyBoard({ onOpenDetail }: { onOpenDetail: (id: number) => void }) {
  const { t } = useTranslation(["vacancies", "common"]);
  const { data: vacancies = [] } = useVacancies();
  const updateVacancyMutation = useUpdateVacancy();
  const [over, setOver] = useState<string | null>(null);
  // Card refs for DnD-independent (keyboard-only) moves: after a status change React
  // remounts the card into a different column — without this the focus would be lost.
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const onDrop = (status: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const v = vacancies.find((x) => x.id === id);
    if (v && v.status !== status) updateVacancyMutation.mutate({ id, patch: { status } });
  };
  // Keyboard alternative to drag-and-drop: ←/→ on a focused card switches it to the
  // adjacent status (order — as in STATUSES), focus stays on the same card.
  const moveByKeyboard = (v: Vacancy, direction: -1 | 1) => {
    const idx = STATUSES.indexOf(v.status as (typeof STATUSES)[number]);
    const nextStatus = STATUSES[idx + direction];
    if (idx === -1 || !nextStatus) return;
    updateVacancyMutation.mutate(
      { id: v.id, patch: { status: nextStatus } },
      { onSuccess: () => requestAnimationFrame(() => cardRefs.current[v.id]?.focus()) },
    );
  };
  return (
    // snap-x/snap-proximity (mobile only, sm:snap-none above): a phone-width column would
    // otherwise stop mid-scroll showing an awkward sliver of two half-visible columns — a swipe
    // now settles on one full column at a time. Column width itself scales the same way (~90vw
    // on a phone → the fixed 256px board unchanged from sm: up), pure CSS, no change to the
    // drag/keyboard/dropdown status-change logic below.
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-proximity sm:snap-none">
      {STATUSES.map((status) => {
        const items = vacancies.filter((v) => v.status === status);
        return (
          <div
            key={status}
            role="list"
            aria-label={t("kanban.columnAriaLabel", { status: statusLabel(status), count: items.length })}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((cur) => (cur === status ? null : cur))}
            onDrop={onDrop(status)}
            className={`shrink-0 w-[90vw] sm:w-64 snap-start rounded-xl border p-2 transition-colors ${
              over === status ? "border-signal/50 bg-signal/10" : "border-grid bg-surface-2"
            }`}
          >
            <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink-dim">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT_CLASS[status] ?? DEFAULT_STATUS_DOT_CLASS}`} />
                {statusLabel(status)}
              </span>
              <span className="text-[11px] text-ink-dim">{items.length}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {items.map((v) => {
                const idx = STATUSES.indexOf(status);
                // Mark exactly the card whose status is currently being saved (drag-and-drop or
                // keyboard move) — updateVacancyMutation is one hook for the whole board, so
                // scope by variables.id so the spinner doesn't flash on every card at once.
                const isSaving = updateVacancyMutation.isPending && updateVacancyMutation.variables?.id === v.id;
                const cardAriaLabel =
                  t("kanban.cardStatus", { company: v.company, position: v.position, status: statusLabel(status) }) +
                  (idx > 0 ? t("kanban.leftArrowHint", { status: statusLabel(STATUSES[idx - 1]!) }) : "") +
                  (idx < STATUSES.length - 1 ? t("kanban.rightArrowHint", { status: statusLabel(STATUSES[idx + 1]!) }) : "");
                return (
                  <div
                    key={v.id}
                    ref={(el) => {
                      cardRefs.current[v.id] = el;
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={cardAriaLabel}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(v.id))}
                    // Opens the "Jira issue"-style detail popup (vacancy-detail-modal.tsx) —
                    // except when the click actually landed on a real nested control (the "Move ▾"
                    // dropdown, "Similar vacancies"), which should handle its own click instead.
                    // A completed drag doesn't fire a click event at all, so this doesn't conflict
                    // with dragging the card between columns.
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a")) return;
                      onOpenDetail(v.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        moveByKeyboard(v, 1);
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        moveByKeyboard(v, -1);
                      } else if ((e.key === "Enter" || e.key === " ") && !(e.target as HTMLElement).closest("button, a")) {
                        // A real <button> would dispatch this automatically; a div role="button"
                        // needs it wired by hand for keyboard parity with the onClick above.
                        e.preventDefault();
                        onOpenDetail(v.id);
                      }
                    }}
                    className={`relative bg-surface border border-grid border-l-4 ${STATUS_BORDER_L_CLASS[status] ?? DEFAULT_STATUS_BORDER_L_CLASS} rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-card focus:outline-none focus:ring-2 focus:ring-signal/50 transition-opacity ${isSaving ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-ink truncate">{v.company}</div>
                        <div className="text-xs text-ink-dim truncate">{v.position}</div>
                      </div>
                      <div className="shrink-0">
                        {isSaving ? (
                          <span className="text-signal inline-flex" aria-label={t("common:state.saving")}>
                            <Spinner className="h-3 w-3" />
                          </span>
                        ) : (
                          // Jumping straight to any status (not just the adjacent one drag/←/→
                          // give you) — the fast path for e.g. "Want to apply" → "Rejected" without
                          // dragging across the whole board or repeating an arrow key.
                          <Dropdown label={t("kanban.move")} align="right">
                            {STATUSES.filter((s) => s !== status).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateVacancyMutation.mutate({ id: v.id, patch: { status: s } })}
                                className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-surface-2"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_CLASS[s] ?? DEFAULT_STATUS_DOT_CLASS}`} />
                                {statusLabel(s)}
                              </button>
                            ))}
                          </Dropdown>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Chip tone={fitTone[v.fit]}>{fitLabel(v.fit)}</Chip>
                      {v.stack.slice(0, 2).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-dim">
                          {s}
                        </span>
                      ))}
                      {v.stack.length > 2 && <span className="text-[10px] text-ink-dim">+{v.stack.length - 2}</span>}
                      <span className="ml-auto">
                        <SimilarVacanciesButton vacancyId={v.id} />
                      </span>
                    </div>
                    {v.salary && <div className="text-[11px] text-signal mt-1">{v.salary}</div>}
                    {v.next && <div className="text-[11px] text-alert mt-1">⏭ {v.next}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
