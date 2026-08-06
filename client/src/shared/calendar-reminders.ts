import type { CalendarEvent } from "./types";

// How long before a manual calendar event (interview/call/deadline/reminder/other — see
// CALENDAR_EVENT_TYPES) starts that we fire a heads-up browser notification. Vacancy next-steps
// and SRS due-cards are date-only (no time-of-day), so a "starts in N minutes" reminder doesn't
// apply to them — only real calendar_events rows (which always carry a precise startAt) qualify.
export const REMINDER_WINDOW_MINUTES = 15;

const LS_NOTIFIED_KEY = "jobtrack.calendarReminders.notified";
// Prune entries whose event started more than this long ago — keeps the set from growing
// unbounded across months of daily use, without needing the full historical event list to know
// what's safe to drop (see pruneNotified below).
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

/** eventId -> its ISO startAt, so pruneNotified() can tell how old an entry is without re-fetching. */
type NotifiedMap = Record<string, string>;

function readNotified(): NotifiedMap {
  try {
    return JSON.parse(localStorage.getItem(LS_NOTIFIED_KEY) || "{}") as NotifiedMap;
  } catch {
    return {};
  }
}

function writeNotified(map: NotifiedMap): void {
  localStorage.setItem(LS_NOTIFIED_KEY, JSON.stringify(map));
}

/** Pure — drops entries whose event start is more than 24h in the past. Exported for unit testing
 * without touching localStorage. */
export function pruneNotified(nowMs: number, map: NotifiedMap): NotifiedMap {
  const next: NotifiedMap = {};
  for (const [id, startAt] of Object.entries(map)) {
    const startMs = new Date(startAt).getTime();
    if (!Number.isNaN(startMs) && nowMs - startMs < PRUNE_AFTER_MS) next[id] = startAt;
  }
  return next;
}

/** Reads the "already notified" set from localStorage, pruning (and persisting the pruned
 * result) as it goes. */
export function getNotifiedEventIds(nowMs: number): Set<number> {
  const pruned = pruneNotified(nowMs, readNotified());
  writeNotified(pruned);
  return new Set(Object.keys(pruned).map(Number));
}

export function markNotified(event: CalendarEvent): void {
  const map = readNotified();
  map[event.id] = event.startAt;
  writeNotified(map);
}

/** Pure — which events start within REMINDER_WINDOW_MINUTES from now (and haven't already
 * started) that we haven't notified about yet. Exported for unit testing without a DB/Notification
 * API. */
export function findEventsToNotify(events: CalendarEvent[], nowMs: number, alreadyNotifiedIds: Set<number>): CalendarEvent[] {
  const windowMs = REMINDER_WINDOW_MINUTES * 60_000;
  return events.filter((e) => {
    if (alreadyNotifiedIds.has(e.id)) return false;
    const startMs = new Date(e.startAt).getTime();
    if (Number.isNaN(startMs)) return false;
    return startMs > nowMs && startMs - nowMs <= windowMs;
  });
}
