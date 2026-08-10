// Storage for push notifications: the dedupe ledger (`notifications_sent`), the per-kind
// preferences, and the scheduler's one global query.
//
// The preferences columns live on `digest_preferences` — the same row the weekly digest already
// keeps per user — rather than in a second one-row-per-user table. This module owns
// `notification_prefs`/`timezone`; digest.repo.ts keeps owning `enabled`/`last_sent_at`. They're
// deliberately kept apart: `enabled` means "email me a weekly digest", NOT "notify me at all", and
// conflating them would force a user who only wants interview reminders to also switch the weekly
// email on.
import { and, count, eq, lt, lte } from "drizzle-orm";
import db from "../../db/client.js";
import { digestPreferences, notificationsSent, srs, telegramLinks, user } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

/**
 * Atomically reserves the right to send one notification, returning false if it was already sent
 * recently. The whole check-and-mark is ONE statement on purpose: the schedulers run behind an
 * advisory lock today, but a plain "select, then insert" would still be a race the moment anything
 * sends outside that lock (the event-triggered notifications do — a public CV view is just an
 * inbound HTTP request, and two concurrent viewers hit this at the same instant).
 *
 * @param ttlMs How long the claim holds. `Infinity` (the default) makes it permanent — a one-shot
 * latch, for reminders that must never repeat ("interview 42, the 24h warning"). A finite TTL makes
 * it a debounce that re-arms afterwards, for recurring nudges (a daily streak reminder) and for
 * rate-limiting genuinely repeatable events (one CV-view ping per hour, not one per page load).
 */
export async function claimNotification(userId: UserId, key: string, ttlMs = Number.POSITIVE_INFINITY): Promise<boolean> {
  // `sentAt` is written EXPLICITLY rather than left to the column's `now()` default, even on the
  // insert path. The TTL comparison below is computed in JS, and letting the insert use the
  // database clock instead would compare two different clocks — which is undefined exactly at the
  // boundary this function's correctness depends on. One clock, both sides.
  const now = new Date();
  if (!Number.isFinite(ttlMs)) {
    const rows = await db
      .insert(notificationsSent)
      .values({ userId, key, sentAt: now })
      .onConflictDoNothing()
      .returning({ key: notificationsSent.key });
    return rows.length > 0;
  }
  const cutoff = new Date(now.getTime() - ttlMs);
  // `setWhere` gates the DO UPDATE branch: when the existing row is still fresh the update is
  // skipped, no row comes back from RETURNING, and the caller sees `false`.
  const rows = await db
    .insert(notificationsSent)
    .values({ userId, key, sentAt: now })
    .onConflictDoUpdate({
      target: [notificationsSent.userId, notificationsSent.key],
      set: { sentAt: now },
      setWhere: lt(notificationsSent.sentAt, cutoff),
    })
    .returning({ key: notificationsSent.key });
  return rows.length > 0;
}

/** Housekeeping for the ledger, called from the scheduler's own tick rather than a cron of its own
 * — same lazy-sweep reasoning as telegram.repo.ts#resolveLinkToken. Safe because every key this
 * app writes is tied to something that stops mattering long before the cutoff: an interview whose
 * date has passed can't come back, and a re-armed debounce key is simply re-created on next use. */
export async function sweepNotificationLedger(olderThanMs: number): Promise<number> {
  const deleted = await db
    .delete(notificationsSent)
    .where(lt(notificationsSent.sentAt, new Date(Date.now() - olderThanMs)))
    .returning({ key: notificationsSent.key });
  return deleted.length;
}

export interface NotificationSettings {
  prefs: Record<string, boolean>;
  timezone: string | null;
}

const DEFAULT_SETTINGS: NotificationSettings = { prefs: {}, timezone: null };

export async function getNotificationSettings(userId: UserId): Promise<NotificationSettings> {
  const [row] = await db
    .select({ prefs: digestPreferences.notificationPrefs, timezone: digestPreferences.timezone })
    .from(digestPreferences)
    .where(eq(digestPreferences.userId, userId));
  return row ?? DEFAULT_SETTINGS;
}

/** Upsert, not update: a user who never touched the weekly-digest toggle has no row here at all,
 * and saving notification preferences must not silently no-op for them. `enabled` is left at its
 * column default on insert and untouched on conflict — this module must never flip the digest on. */
export async function setNotificationSettings(userId: UserId, settings: NotificationSettings): Promise<NotificationSettings> {
  await db
    .insert(digestPreferences)
    .values({ userId, notificationPrefs: settings.prefs, timezone: settings.timezone })
    .onConflictDoUpdate({
      target: digestPreferences.userId,
      set: { notificationPrefs: settings.prefs, timezone: settings.timezone },
    });
  return getNotificationSettings(userId);
}

/** Records the browser's IANA zone without touching anything else — called opportunistically on a
 * normal authed request (see notifications.routes.ts), so the evening streak nudge knows what
 * "evening" means for this user without making them fill in a settings field. */
export async function setUserTimezone(userId: UserId, timezone: string): Promise<void> {
  await db
    .insert(digestPreferences)
    .values({ userId, timezone })
    .onConflictDoUpdate({ target: digestPreferences.userId, set: { timezone } });
}

/** Everything the notifications scheduler needs for one user, in one pass. Global — not scoped to
 * any single userId, like digest.repo.ts#listDigestEnabledUsers and
 * saved-searches.repo.ts#listAllSavedSearches, and called only by the background job.
 *
 * Driven off `telegram_links` (not off digest_preferences) because a linked chat IS the opt-in for
 * push notifications, and it keeps the scan proportional to "users who linked a bot" rather than
 * "every user who ever opened the app". LEFT JOIN on the preferences row: most users never open
 * that settings panel, and a missing row simply means "all defaults". */
export interface NotifiableUser {
  userId: UserId;
  chatId: string;
  email: string;
  prefs: Record<string, boolean>;
  timezone: string | null;
}

export async function listNotifiableUsers(): Promise<NotifiableUser[]> {
  const rows = await db
    .select({
      userId: telegramLinks.userId,
      chatId: telegramLinks.chatId,
      email: user.email,
      prefs: digestPreferences.notificationPrefs,
      timezone: digestPreferences.timezone,
    })
    .from(telegramLinks)
    .innerJoin(user, eq(user.id, telegramLinks.userId))
    .leftJoin(digestPreferences, eq(digestPreferences.userId, telegramLinks.userId));
  return rows.map((r) => ({ ...r, userId: r.userId as UserId, prefs: r.prefs ?? {} }));
}

/** The email address for a user, for the notify() seam's optional email leg. Returns null for a
 * user that no longer exists (a notification racing an account deletion). */
export async function getUserEmail(userId: UserId): Promise<string | null> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  return row?.email ?? null;
}

/** How many flashcards are due for this user as of `today` (a "YYYY-MM-DD" local date). A COUNT
 * rather than db/kv.ts#getSrsStateByCard: the streak nudge only ever needs the number, and the
 * scheduler asks this once per user per evening — pulling every SRS row back just to measure its
 * length would make that the most expensive query in the tick. */
export async function countDueSrsCards(userId: UserId, today: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(srs)
    .where(and(eq(srs.userId, userId), lte(srs.due, today)));
  return row?.n ?? 0;
}

/** Used by the digest scheduler to honor a Telegram opt-out for the `digest` kind without
 * duplicating the join above for its single-user case. */
export async function getPrefsForUser(userId: UserId): Promise<Record<string, boolean>> {
  const [row] = await db
    .select({ prefs: digestPreferences.notificationPrefs })
    .from(digestPreferences)
    .where(and(eq(digestPreferences.userId, userId)));
  return row?.prefs ?? {};
}
