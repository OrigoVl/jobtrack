// Timezone helpers for the notifications scheduler — the only part of this app that has to reason
// about a user's LOCAL wall clock on the server. Everything else either compares absolute instants
// (an interview starts when it starts, wherever you are) or renders dates in the browser, where
// the platform already knows the zone.
//
// Built on Intl, not a date library: `formatToParts` with a `timeZone` already does the full IANA
// conversion including DST, and this codebase deliberately favors the built-in over a new
// dependency (CLAUDE.md's "don't add dependencies unless the task calls for it").

/** What a NULL `digest_preferences.timezone` means — a user whose browser never reported one. */
export const FALLBACK_TIME_ZONE = "UTC";

/**
 * An unknown or malformed zone must never take down a scheduler tick that's iterating every user:
 * `Intl.DateTimeFormat` THROWS a RangeError on a bad `timeZone`, and the value here comes from a
 * client-supplied string. Falls back to UTC instead.
 */
function safeFormatter(timeZone: string | null, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timeZone || FALLBACK_TIME_ZONE });
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: FALLBACK_TIME_ZONE });
  }
}

/**
 * The user's local calendar date as "YYYY-MM-DD" — the same shape `vacancies.next` and
 * `StreakState.lastActiveDate` already use, so they compare as plain strings.
 *
 * The "en-CA" locale is not cosmetic: it's the one widely-supported locale whose short date format
 * IS ISO order, which makes this a formatting call rather than manual part-reassembly.
 */
export function localDateIn(timeZone: string | null, atMs: number): string {
  return safeFormatter(timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(atMs));
}

/** The user's local hour, 0–23. `hourCycle: "h23"` so midnight is 0 rather than "24". */
export function localHourIn(timeZone: string | null, atMs: number): number {
  const parts = safeFormatter(timeZone, { hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(atMs));
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour ? Number(hour) : 0;
}

/** Whether a client-supplied string is an IANA zone this runtime actually knows — validation for
 * the route that persists it, so a junk value never reaches the column in the first place. */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
