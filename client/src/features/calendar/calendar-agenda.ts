// Pure logic behind the Calendar page's drag-to-reschedule and its "Upcoming" card. Kept out of
// calendar.tsx (which is components only, same split as calendar-date-utils.ts) so both can be
// unit-tested without rendering a grid — see calendar-agenda.test.ts.
import { ymd } from "../../shared/calendar-grid";
import type { CalendarEvent, CalendarVacancyStep } from "../../shared/types";

/**
 * The ISO start/end an event gets when it's dragged onto `day` ("yyyy-MM-dd"): the TIME OF DAY is
 * preserved and the end moves with the start, so dropping a 14:00–15:00 interview on next Tuesday
 * keeps it at 14:00 and an hour long. Shifting `endAt` by the same whole days (rather than
 * recomputing it from the duration) is what keeps a multi-day event multi-day.
 *
 * Returns null when the drop is a no-op (same day) so the caller can skip the mutation entirely.
 */
export function moveEventToDay(
  event: Pick<CalendarEvent, "startAt" | "endAt">,
  day: string,
): { startAt: string; endAt: string | null } | null {
  const start = new Date(event.startAt);
  if (Number.isNaN(start.getTime())) return null;
  if (ymd(start) === day) return null;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;

  const nextStart = new Date(start);
  nextStart.setFullYear(y, m - 1, d);

  let nextEnd: string | null = null;
  if (event.endAt) {
    const end = new Date(event.endAt);
    if (!Number.isNaN(end.getTime())) {
      // Whole-day delta between the two local dates, applied to the end — `setDate` past the end
      // of a month rolls over correctly, and DST is handled because both ends move by dates, not
      // by a fixed number of milliseconds.
      const dayDelta = Math.round((startOfLocalDay(nextStart).getTime() - startOfLocalDay(start).getTime()) / 86_400_000);
      end.setDate(end.getDate() + dayDelta);
      nextEnd = end.toISOString();
    }
  }
  return { startAt: nextStart.toISOString(), endAt: nextEnd };
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type UpcomingItem =
  | { kind: "event"; day: string; sortKey: string; event: CalendarEvent }
  | { kind: "step"; day: string; sortKey: string; step: CalendarVacancyStep };

/**
 * The next `limit` things coming up on or after `fromDay`, events and vacancy next-steps merged
 * into one chronological list. Vacancy steps are date-only, so they sort at the START of their day
 * (they're a "sometime today" item, not a timed one) — hence the "T00:00" sort key.
 */
export function buildUpcoming(events: CalendarEvent[], steps: CalendarVacancyStep[], fromDay: string, limit: number): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const event of events) {
    const start = new Date(event.startAt);
    if (Number.isNaN(start.getTime())) continue;
    const day = ymd(start);
    if (day < fromDay) continue;
    items.push({
      kind: "event",
      day,
      sortKey: `${day}T${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      event,
    });
  }
  for (const step of steps) {
    if (step.date < fromDay) continue;
    items.push({ kind: "step", day: step.date, sortKey: `${step.date}T00:00`, step });
  }
  return items.sort((a, b) => (a.sortKey === b.sortKey ? 0 : a.sortKey < b.sortKey ? -1 : 1)).slice(0, limit);
}

/** The day `delta` days away from `day` ("yyyy-MM-dd" in, "yyyy-MM-dd" out) — the arrow-key
 * movement behind the grid's roving focus, where ±1 is a day and ±7 a week. */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return ymd(new Date(y, m - 1, d + delta));
}
