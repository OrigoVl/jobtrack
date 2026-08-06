import type { CalendarEvent } from "./types";

// Free-text pattern match, not a new CalendarEventType — same "own file, pure functions, own
// test file" convention as calendar-reminders.ts, but a much longer lookahead (days, not minutes):
// this is "go prepare," not "it's starting now."
const DESIGN_INTERVIEW_PATTERN = /system design|архітект|architecture/i;

/** Pure — does this calendar event look like a system-design interview, based on its own
 * type + free-text title/notes (no schema change: `notes`/`title` are already free text). */
export function looksLikeDesignInterview(event: CalendarEvent): boolean {
  return event.type === "interview" && DESIGN_INTERVIEW_PATTERN.test(`${event.title} ${event.notes}`);
}

/** Pure — the soonest upcoming design-interview-looking event starting within `withinDays` from
 * now (inclusive of today), or null if none. Exported for unit testing without a clock/DB. */
export function findUpcomingDesignInterview(events: CalendarEvent[], nowMs: number, withinDays: number): CalendarEvent | null {
  const horizonMs = nowMs + withinDays * 86_400_000;
  const candidates = events
    .filter(looksLikeDesignInterview)
    .filter((e) => {
      const startMs = new Date(e.startAt).getTime();
      return !Number.isNaN(startMs) && startMs >= nowMs && startMs <= horizonMs;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  return candidates[0] ?? null;
}
