// Pure date helpers for the Calendar feature — extracted from calendar.tsx (keeps that file
// purely component-based for react-refresh, same reason shared/fit-tone.ts was split out of
// view-kit.tsx) and independently unit-tested in calendar-date-utils.test.ts.

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local Y-M-D (not UTC) — matches what the user actually sees on their own calendar/clock. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** For a native `<input type="datetime-local">`, which reads/writes local wall-clock time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** `new Date("...")` on a timezone-less date-time string parses it as LOCAL time (per spec) —
 * `.toISOString()` then gives the correct UTC instant to send to the API. */
export function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
