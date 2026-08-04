// Local <-> UTC conversion for the Calendar feature's datetime fields — extracted from
// calendar.tsx (keeps that file purely component-based for react-refresh, same reason
// shared/fit-tone.ts was split out of view-kit.tsx) and independently unit-tested in
// calendar-date-utils.test.ts. Month-grid math (ymd, buildMonthCells) lives in
// shared/calendar-grid.ts — it's reused by the DatePicker popover, not just this feature.
import { ymd } from "../../shared/calendar-grid";

const pad2 = (n: number) => String(n).padStart(2, "0");

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
