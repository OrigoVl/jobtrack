// Push-notification scheduler — the third and last plain `setInterval` in this app (see
// saved-searches.scheduler.ts's top comment for why a queue/worker system stays out of proportion
// here). Everything about WHEN something is due lives in notifications.service.ts; this file is
// the I/O around it.
//
// It ticks far more often than the other two (15 minutes vs 4 and 12 hours) because it owns the
// time-sensitive notifications — "your interview starts in an hour" is worthless on a 12-hour
// cadence. That's affordable only because the pass is driven off `telegram_links`: a deployment
// where nobody linked a chat does one indexed query every 15 minutes and stops.
import { contextLogger } from "../../core/logger.js";
import { withAdvisoryLock } from "../../db/index.js";
import { getStudyStreak } from "../../db/kv.js";
import { notify } from "../../shared/notify.js";
import { isNotificationEnabled } from "../../shared/notifications.js";
import { localDateIn, localHourIn } from "../../shared/time.js";
import { listCalendarEvents } from "../calendar/calendar.repo.js";
import { listVacancyReminderRows } from "../vacancies/vacancies.repo.js";
import { vacancyButtons } from "../telegram/telegram.callbacks.js";
import { countDueSrsCards, listNotifiableUsers, sweepNotificationLedger, type NotifiableUser } from "./notifications.repo.js";
import {
  buildInterviewReminders,
  buildNextStepReminders,
  buildStaleReminders,
  buildStreakReminder,
  STREAK_REMINDER_HOUR,
  type PendingNotification,
} from "./notifications.service.js";

export const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes — the finest granularity any reminder here needs

// Arbitrary but must stay unique among this codebase's pg_advisory_lock keys — the other two are
// digest.scheduler.ts's 72_701_001 and saved-searches.scheduler.ts's 72_701_002.
const NOTIFICATIONS_SCHEDULER_LOCK_KEY = 72_701_003;

// How long a spent dedupe row is kept before the lazy sweep drops it. Comfortably longer than the
// longest-lived claim (the 7-day stale-reminder debounce) so a sweep can never re-arm something
// that's still meant to be suppressed, and long enough that an interview reminder's latch outlives
// any plausible clock skew between replicas.
const LEDGER_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

// How far ahead to load calendar events. Just past the widest interview threshold (24h) — loading
// a user's whole calendar to find the two rows that matter would make this the tick's heaviest
// query, and calendar_events is already indexed on (user_id, start_at) for exactly this shape.
const INTERVIEW_LOOKAHEAD_MS = 36 * 60 * 60 * 1000;

/** Gathers everything due for one user. Each source is skipped entirely when its kind is switched
 * off, so an opted-out user costs no queries rather than queries whose results get thrown away. */
async function collectPending(u: NotifiableUser, nowMs: number): Promise<PendingNotification[]> {
  const wants = (kind: Parameters<typeof isNotificationEnabled>[1]) => isNotificationEnabled(u.prefs, kind);
  const pending: PendingNotification[] = [];

  // Interviews and everything else on the calendar are separate opt-outs but one query — asking
  // twice for the same window would double this tick's heaviest per-user read.
  if (wants("interview") || wants("event")) {
    const events = await listCalendarEvents(u.userId, {
      from: new Date(nowMs).toISOString(),
      to: new Date(nowMs + INTERVIEW_LOOKAHEAD_MS).toISOString(),
    });
    const relevant = events
      .filter((e) => (e.type === "interview" ? wants("interview") : wants("event")))
      .map((e) => ({ id: e.id, title: e.title, startAt: e.startAt, type: e.type }));
    pending.push(...buildInterviewReminders(relevant, u.timezone, nowMs));
  }

  // One query feeding two independent rules — they need the same projection, and asking twice
  // would double the tick's heaviest per-user read for nothing.
  if (wants("nextStep") || wants("stale")) {
    const rows = await listVacancyReminderRows(u.userId);
    if (wants("nextStep")) pending.push(...buildNextStepReminders(rows, u.timezone, nowMs));
    if (wants("stale")) pending.push(...buildStaleReminders(rows, nowMs));
  }

  if (wants("streak")) {
    const streak = await getStudyStreak(u.userId);
    // The hour check is duplicated from buildStreakReminder deliberately: it's the difference
    // between one cheap COUNT per user per evening and one on all 96 ticks of the day.
    const reminder =
      streak.current >= 1 && localHourIn(u.timezone, nowMs) >= STREAK_REMINDER_HOUR
        ? buildStreakReminder(streak, await countDueSrsCards(u.userId, localDateIn(u.timezone, nowMs)), u.timezone, nowMs)
        : null;
    if (reminder) pending.push(reminder);
  }

  return pending;
}

async function processOneUser(u: NotifiableUser, nowMs: number): Promise<void> {
  for (const p of await collectPending(u, nowMs)) {
    // chatId/prefs are passed through from the batch query — notify() would otherwise re-read both
    // per notification, which is the exact per-user N+1 this scheduler is shaped to avoid.
    await notify(
      u.userId,
      {
        kind: p.kind,
        text: p.text,
        dedupeKey: p.dedupeKey,
        dedupeTtlMs: p.dedupeTtlMs,
        ...(p.vacancyId !== undefined ? { buttons: vacancyButtons(p.vacancyId) } : {}),
      },
      { chatId: u.chatId, prefs: u.prefs },
    );
  }
}

export async function runNotificationsOnce(nowMs = Date.now()): Promise<void> {
  const users = await listNotifiableUsers();
  for (const u of users) {
    try {
      await processOneUser(u, nowMs);
    } catch (err) {
      // One user's bad data (an unparseable calendar row, a transient DB hiccup) must not stop the
      // rest of the batch — same fail-isolation shape as the other two schedulers' per-item loops.
      contextLogger().error({ err, userId: u.userId }, "Failed to process one user's notifications");
    }
  }
  // Housekeeping on the same tick rather than a fourth timer, like digest.scheduler.ts piggybacks
  // the referral sweep — and likewise it must never block the actual run above, hence last.
  await sweepNotificationLedger(LEDGER_RETENTION_MS).catch((err) =>
    contextLogger().error({ err }, "Failed to sweep the notification ledger"),
  );
}

/** Starts the recurring job — called once from index.ts at boot. `unref()` so this timer alone
 * never keeps the process alive (the HTTP server already does that); it still fires normally for
 * as long as the process is otherwise running. */
export function startNotificationsScheduler(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  const timer = setInterval(() => {
    // With 2+ replicas, every replica's own `setInterval` fires independently — the advisory lock
    // ensures only one replica's tick actually runs, so a user never gets the same reminder
    // duplicated once per replica. (The dedupe ledger would catch it too, but the lock keeps the
    // redundant work from being done at all.)
    void withAdvisoryLock(NOTIFICATIONS_SCHEDULER_LOCK_KEY, () => runNotificationsOnce()).catch((err) =>
      contextLogger().error({ err }, "Notifications scheduler run failed"),
    );
  }, intervalMs);
  timer.unref();
  return timer;
}
