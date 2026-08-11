import type { Contact } from "../../shared/types";

/**
 * Days of silence after which a conversation is worth a nudge. Seven, so it always spans a full
 * working week: a recruiter contacted on Friday isn't "ignoring you" on Tuesday, and a threshold
 * shorter than a week would flag half the list every Monday and teach the user to ignore the flag.
 */
export const STALE_AFTER_DAYS = 7;

/** Whole days between two ISO dates (YYYY-MM-DD), or null if either isn't one. Date-only on
 * purpose: `lastContactAt` has no time component, so anything finer would be invented precision. */
export function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / 86_400_000);
}

/**
 * How long this conversation has been quiet, or null when the question doesn't apply.
 *
 * A contact with no `lastContactAt` is NOT stale: nobody has written to them yet, which is a
 * different situation with a different fix ("reach out" rather than "follow up"), and flagging it
 * as silence would be simply untrue. A future-dated value returns null for the same reason — it
 * describes a planned touch, not a past one.
 */
export function silentDays(contact: Contact, todayIso: string): number | null {
  if (!contact.lastContactAt) return null;
  const days = daysBetween(contact.lastContactAt, todayIso);
  return days === null || days < 0 ? null : days;
}

export function isStale(contact: Contact, todayIso: string): boolean {
  const days = silentDays(contact, todayIso);
  return days !== null && days >= STALE_AFTER_DAYS;
}

/** Stale conversations, longest silence first — the order in which they're worth chasing. */
export function staleContacts(contacts: Contact[], todayIso: string): Contact[] {
  return contacts.filter((c) => isStale(c, todayIso)).sort((a, b) => (silentDays(b, todayIso) ?? 0) - (silentDays(a, todayIso) ?? 0));
}
