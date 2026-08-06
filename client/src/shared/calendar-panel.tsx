import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildMonthCells, ymd } from "./calendar-grid";

/**
 * A small month-grid day picker, reusing the same day-grid math as the full Calendar page.
 * Presentational only — the caller decides how the popover is positioned/closed (see
 * DateInput/DateTimeInput's picker button).
 *
 * Month label, weekday abbreviations, and each day's accessible name follow the app's active
 * language (i18n.language) — NOT `navigator`/OS locale, which is exactly the uncontrolled
 * rendering DateInput/DateTimeInput deliberately avoid elsewhere. Weekday abbreviations are
 * derived from the grid's own first week rather than a hardcoded array, so they can never drift
 * out of sync with buildMonthCells' Monday-first layout.
 */
export function CalendarPanel({
  selected,
  onSelect,
}: {
  /** Local "yyyy-MM-dd" of the currently selected day, or "" if none. */
  selected: string;
  onSelect: (ymd: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const initial = selected ? new Date(`${selected}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const cells = buildMonthCells(viewYear, viewMonth);
  const today = ymd(new Date());

  const monthLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }), [i18n.language]);
  const weekdayShort = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: "short" }), [i18n.language]);
  const dayAriaLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [i18n.language],
  );

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <div className="w-64 p-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          type="button"
          data-keep-open
          aria-label={t("dateInput.previousMonth")}
          onClick={() => shiftMonth(-1)}
          className="w-7 h-7 grid place-items-center rounded-lg text-ink-dim hover:bg-surface-2 hover:text-ink"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-ink">{monthLabel.format(new Date(viewYear, viewMonth, 1))}</span>
        <button
          type="button"
          data-keep-open
          aria-label={t("dateInput.nextMonth")}
          onClick={() => shiftMonth(1)}
          className="w-7 h-7 grid place-items-center rounded-lg text-ink-dim hover:bg-surface-2 hover:text-ink"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-ink-dim mb-1">
        {cells.slice(0, 7).map((cell) => (
          <div key={cell.key}>{weekdayShort.format(cell.date)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const isToday = cell.key === today;
          const isSelected = cell.key === selected;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelect(cell.key)}
              aria-label={dayAriaLabel.format(cell.date)}
              aria-current={isToday ? "date" : undefined}
              className={`h-7 rounded-lg text-xs ${cell.inMonth ? "text-ink" : "text-ink-dim/50"} ${
                isSelected
                  ? "bg-star text-on-signal font-semibold"
                  : isToday
                    ? "border border-signal/60 font-semibold"
                    : "hover:bg-surface-2"
              }`}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
