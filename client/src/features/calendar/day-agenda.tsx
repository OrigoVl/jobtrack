import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Chip, Spinner } from "../../shared/ui";
import { CardsStackIcon } from "../../shared/icons";
import type { CalendarEvent, CalendarVacancyStep } from "../../shared/types";
import { TYPE_CHIP, TYPE_DOT, TYPE_KEY } from "./calendar-shared";

/**
 * Everything happening on ONE day: vacancy next-steps, SRS due-count, the day's events (each
 * editable/deletable inline) and a one-field quick-add. Rendered inside the popover that opens
 * from a day cell, so the whole interaction — see what's on a day, add something, fix a typo —
 * happens under the cursor instead of in a card below the grid.
 *
 * Presentational: the page owns the data and every mutation. It is rendered inside a PopoverPanel,
 * which closes on any click that isn't inside a `[data-keep-open]` subtree — the root here carries
 * that attribute, and the actions that SHOULD dismiss the popover (opening the full modal,
 * navigating away) call `onClose` themselves.
 */
export function DayAgenda({
  dayLabel,
  timeLabel,
  events,
  steps,
  srsDue,
  deletingId,
  quickAdding,
  contactName,
  onAddFull,
  onEdit,
  onDelete,
  onQuickAdd,
  onGoVacancies,
  onGoStudy,
}: {
  dayLabel: string;
  timeLabel: Intl.DateTimeFormat;
  events: CalendarEvent[];
  steps: CalendarVacancyStep[];
  srsDue: number;
  deletingId: number | null;
  quickAdding: boolean;
  /** Resolves an event's linked contact to a display name — undefined when the contact list
   * hasn't loaded yet (or the link points at a since-deleted row), in which case nothing is shown
   * rather than a bare id. */
  contactName: (contactId: number) => string | undefined;
  onAddFull: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onQuickAdd: (title: string) => void;
  onGoVacancies: () => void;
  onGoStudy: () => void;
}) {
  const { t } = useTranslation(["calendar", "common"]);
  const [quickTitle, setQuickTitle] = useState("");

  const submitQuick = (e: FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    onQuickAdd(title);
    setQuickTitle("");
  };

  // Width: wide enough for a real event title + time + type chip without truncating, and capped
  // to the viewport so the panel can't overflow a phone screen.
  return (
    <div data-keep-open className="w-[23rem] max-w-[calc(100vw-1rem)] p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="font-display font-semibold text-sm text-ink leading-tight">{dayLabel}</div>
        <Btn size="sm" variant="ghost" className="ml-auto shrink-0" onClick={onAddFull}>
          {t("addEventShort")}
        </Btn>
      </div>

      {steps.map((s) => (
        <button
          key={s.vacancyId}
          type="button"
          onClick={onGoVacancies}
          className="w-full flex items-center gap-2 text-xs text-left px-2 py-1.5 rounded-lg border border-alert/30 bg-alert/10 hover:bg-alert/20 transition-colors"
        >
          <Chip tone="amber">{t("nextStep")}</Chip>
          <span className="text-ink break-words">
            {s.company} — <span className="text-ink-dim">{s.position || t("modal.position")}</span>
          </span>
        </button>
      ))}

      {srsDue > 0 && (
        <button
          type="button"
          onClick={onGoStudy}
          className="w-full flex items-center gap-2 text-xs text-left px-2 py-1.5 rounded-lg border border-signal/30 bg-signal/10 hover:bg-signal/20 transition-colors"
        >
          <CardsStackIcon className="h-3.5 w-3.5 text-signal shrink-0" />
          <span className="text-ink">{t("flashcardsDue", { count: srsDue })}</span>
        </button>
      )}

      {events.length === 0 && steps.length === 0 && srsDue === 0 && <div className="text-xs text-ink-dim py-1">{t("empty.title")}</div>}

      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg border border-grid">
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[e.type]}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink font-medium break-words">{e.title || t("untitledEvent")}</div>
            <div className="text-[11px] text-ink-dim mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>
                {timeLabel.format(new Date(e.startAt))}
                {e.endAt && ` – ${timeLabel.format(new Date(e.endAt))}`}
              </span>
              <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TYPE_CHIP[e.type]}`}>
                {t(TYPE_KEY[e.type])}
              </span>
            </div>
            {e.contactId != null && contactName(e.contactId) && (
              <div className="text-[11px] text-ink-dim mt-0.5 truncate">
                <span aria-hidden>👤</span> {contactName(e.contactId)}
              </div>
            )}
            {e.notes && <div className="text-[11px] text-ink-dim mt-1 whitespace-pre-wrap line-clamp-3">{e.notes}</div>}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(e)}
              className="text-[11px] text-ink-dim hover:text-signal px-1 py-0.5"
              aria-label={t("editAriaLabel", { title: e.title })}
            >
              {t("common:actions.edit")}
            </button>
            <button
              type="button"
              onClick={() => onDelete(e)}
              disabled={deletingId === e.id}
              className="text-[11px] text-ink-dim hover:text-rose-600 px-1 py-0.5 disabled:opacity-50"
              aria-label={t("deleteAriaLabel", { title: e.title })}
            >
              {deletingId === e.id ? <Spinner className="h-3 w-3" /> : t("common:actions.delete")}
            </button>
          </div>
        </div>
      ))}

      {/* Quick-add: a title is the only thing most entries actually need, and the event lands at
          this day's default time — the full modal stays one click away for times/type/notes. */}
      <form onSubmit={submitQuick} className="flex items-center gap-1.5 pt-0.5">
        <input
          value={quickTitle}
          onChange={(ev) => setQuickTitle(ev.target.value)}
          placeholder={t("quickAddPlaceholder")}
          aria-label={t("quickAddPlaceholder")}
          className="min-w-0 flex-1 bg-surface-2 border border-grid rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
        <Btn type="submit" size="sm" disabled={!quickTitle.trim()} loading={quickAdding}>
          {t("common:actions.add")}
        </Btn>
      </form>
    </div>
  );
}
