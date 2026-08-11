import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "../../shared/ui";
import type { CalendarEvent } from "../../shared/types";
import type { UpcomingItem } from "./calendar-agenda";
import { STEP_DOT, TYPE_CHIP, TYPE_DOT, TYPE_KEY } from "./calendar-shared";

/**
 * The chronological "date · time · title · type" row list, shared by the Upcoming card and the
 * Calendar page's list view — they differ only in which window of items they pass in (the next
 * few from today vs. everything in the visible month), not in how a row looks.
 *
 * Events open the edit modal; a vacancy next-step is read-only here (it belongs to the vacancy)
 * and navigates to where it can actually be changed.
 */
export function AgendaRows({
  items,
  onOpenEvent,
  onGoVacancies,
}: {
  items: UpcomingItem[];
  onOpenEvent: (event: CalendarEvent) => void;
  onGoVacancies: () => void;
}) {
  const { t, i18n } = useTranslation(["calendar", "common"]);
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "short", month: "short", day: "numeric" }),
    [i18n.language],
  );
  const timeLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }), [i18n.language]);

  return (
    <div className="space-y-1.5">
      {items.map((item) =>
        item.kind === "event" ? (
          <button
            key={`e${item.event.id}`}
            type="button"
            onClick={() => onOpenEvent(item.event)}
            aria-label={t("editAriaLabel", { title: item.event.title })}
            className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg border border-grid hover:bg-surface-2 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[item.event.type]}`} />
            <span className="text-xs text-ink-dim w-28 shrink-0">
              {dayLabel.format(new Date(item.event.startAt))}, {timeLabel.format(new Date(item.event.startAt))}
            </span>
            <span className="text-sm text-ink truncate">{item.event.title || t("untitledEvent")}</span>
            <span
              className={`ml-auto shrink-0 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TYPE_CHIP[item.event.type]}`}
            >
              {t(TYPE_KEY[item.event.type])}
            </span>
          </button>
        ) : (
          <button
            key={`s${item.step.vacancyId}-${item.step.date}`}
            type="button"
            onClick={onGoVacancies}
            className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg border border-alert/30 bg-alert/10 hover:bg-alert/20 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${STEP_DOT}`} />
            <span className="text-xs text-ink-dim w-28 shrink-0">{dayLabel.format(new Date(`${item.step.date}T00:00`))}</span>
            <span className="text-sm text-ink truncate">
              {item.step.company} — <span className="text-ink-dim">{item.step.position || t("modal.position")}</span>
            </span>
            <span className="ml-auto shrink-0">
              <Chip tone="amber">{t("nextStep")}</Chip>
            </span>
          </button>
        ),
      )}
    </div>
  );
}
