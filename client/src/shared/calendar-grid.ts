// Pure month-grid date math, shared by the full Calendar page (features/calendar) and the
// DatePicker popover (shared/calendar-panel.tsx).

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local Y-M-D (not UTC) — matches what the user actually sees on their own calendar/clock. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export interface MonthCell {
  date: Date;
  key: string;
  inMonth: boolean;
}

/** Always 42 cells (6 full Mon-Sun weeks) so the grid's height never jumps between months. */
export function buildMonthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, key: ymd(date), inMonth: date.getMonth() === month };
  });
}
