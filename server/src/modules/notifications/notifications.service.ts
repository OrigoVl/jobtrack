// Pure, DB-free "what is due right now" computation — split out of notifications.scheduler.ts the
// same way digest.service.ts is split out of digest.scheduler.ts, so the timing rules (the part
// that's actually easy to get wrong) are unit-testable without a live DB or a scheduler tick.
//
// Message text is English, like the existing digest/job-alert emails: a scheduler runs outside any
// HTTP request, so core/request-context.ts#getLocale has no store to read and would return the
// default anyway. Translating these means persisting a per-user locale, which is a separate change.
import { isStaleApplication } from "../analytics/analytics.service.js";
import type { StreakState } from "../../db/kv.js";
import { localDateIn, localHourIn } from "../../shared/time.js";
import type { NotificationKind } from "../../shared/notifications.js";

/** One notification the scheduler should attempt. `dedupeKey` is what makes a 15-minute tick safe
 * — see notifications.repo.ts#claimNotification. */
export interface PendingNotification {
  kind: NotificationKind;
  dedupeKey: string;
  /** Omitted means "once, ever" — the right default for a reminder tied to a specific instant. */
  dedupeTtlMs?: number;
  text: string;
  /** Set when the notification is about a specific vacancy, so the caller can hang the quick-action
   * keyboard off it (telegram.callbacks.ts#vacancyButtons). Kept as a plain id rather than the
   * buttons themselves so this module stays free of any Telegram-specific shape. */
  vacancyId?: number;
}

// ---------- calendar events ----------

export interface InterviewEvent {
  id: number;
  title: string;
  startAt: string;
  /** The calendar event's own type. Absent means "interview" — the only kind this module handled
   * before non-interview events were covered, kept so existing callers/tests read unchanged. */
  type?: string;
}

/** Descending, because pickDueThreshold() below relies on scanning from least to most urgent. The
 * 24h slot is "plan your day around this"; the 1h slot is "leave now". */
export const INTERVIEW_THRESHOLDS: readonly { ms: number; slug: string; label: string }[] = [
  { ms: 24 * 60 * 60 * 1000, slug: "24h", label: "tomorrow" },
  { ms: 60 * 60 * 1000, slug: "1h", label: "in about an hour" },
];

/**
 * The most urgent threshold this event has already crossed, or null if it's still further out than
 * every one of them.
 *
 * Expressed as "time remaining is under the threshold" rather than "now falls inside a window
 * around T-24h" on purpose. A window has to be at least as wide as the tick or reminders silently
 * vanish, and it still loses them outright if the process was down when the window passed. This
 * form is self-healing: the first tick after the deadline crosses fires it, however late that is,
 * and the permanent dedupe key is what stops it from then firing on every subsequent tick.
 *
 * Picking only the MOST urgent crossed threshold is what keeps an event created 30 minutes before
 * it starts from emitting the 24h and 1h reminders back to back — remaining time only ever
 * decreases, so the skipped 24h slot can never come due later.
 */
export function pickDueThreshold(startAtMs: number, nowMs: number): { slug: string; label: string } | null {
  if (startAtMs <= nowMs) return null; // already started or past — nothing useful left to warn about
  const remaining = startAtMs - nowMs;
  let due: { slug: string; label: string } | null = null;
  for (const t of INTERVIEW_THRESHOLDS) {
    if (remaining <= t.ms) due = { slug: t.slug, label: t.label };
  }
  return due;
}

function formatTime(startAt: string, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(startAt));
  } catch {
    return startAt;
  }
}

/** How each calendar event type introduces itself in a reminder. Interviews keep the exact wording
 * (and the `interview` notification kind) they had before other types were covered. */
const EVENT_REMINDER_STYLE: Record<string, { emoji: string; noun: string }> = {
  interview: { emoji: "📅", noun: "Interview" },
  call: { emoji: "📞", noun: "Call" },
  deadline: { emoji: "⏳", noun: "Deadline" },
  reminder: { emoji: "🔔", noun: "Reminder" },
  other: { emoji: "📌", noun: "Event" },
};

/**
 * Reminders for anything on the calendar that is about to start, at the thresholds above.
 *
 * The dedupe key keeps the event's TYPE out of it (`interview:12:1h`, `event:12:1h`) so it stays
 * stable across an edit that doesn't move the event — but note that re-typing an event from
 * "call" to "interview" does re-arm it under the other key. That's the right trade: the two
 * notification kinds are independently opt-outable, so a shared key would let a user who muted
 * one still be silenced by a claim made under the other.
 */
export function buildInterviewReminders(events: InterviewEvent[], timeZone: string | null, nowMs: number): PendingNotification[] {
  const out: PendingNotification[] = [];
  for (const e of events) {
    const startAtMs = new Date(e.startAt).getTime();
    if (!Number.isFinite(startAtMs)) continue;
    const due = pickDueThreshold(startAtMs, nowMs);
    if (!due) continue;
    const type = e.type ?? "interview";
    const style = EVENT_REMINDER_STYLE[type] ?? EVENT_REMINDER_STYLE.other!;
    const isInterview = type === "interview";
    out.push({
      kind: isInterview ? "interview" : "event",
      dedupeKey: `${isInterview ? "interview" : "event"}:${e.id}:${due.slug}`,
      text: `${style.emoji} ${style.noun} ${due.label}: ${e.title || "(untitled)"}\n${formatTime(e.startAt, timeZone)}`,
    });
  }
  return out;
}

// ---------- vacancy next steps ----------

export interface VacancyReminderRow {
  id: number;
  company: string;
  position: string;
  status: string;
  applied: string;
  next: string;
}

function vacancyLabel(v: { company: string; position: string }): string {
  return [v.position, v.company].filter(Boolean).join(" — ") || "(untitled vacancy)";
}

/**
 * Fires on the day a vacancy's own `next` date lands, in the USER's timezone — a "today" reminder
 * delivered at 3am because the server is on UTC is worse than none.
 *
 * Deliberately only on the exact day, not for anything already overdue: back-filling every missed
 * next-step would mean a wall of notifications the first time a user links their chat, and an
 * application that has genuinely gone quiet is what buildStaleReminders() below is for.
 *
 * The date is part of the dedupe key, so moving a next-step to a new date legitimately re-arms it.
 */
export function buildNextStepReminders(rows: VacancyReminderRow[], timeZone: string | null, nowMs: number): PendingNotification[] {
  const today = localDateIn(timeZone, nowMs);
  return rows
    .filter((v) => v.next === today)
    .map((v) => ({
      kind: "nextStep" as const,
      dedupeKey: `next:${v.id}:${v.next}`,
      text: `⏰ Next step today: ${vacancyLabel(v)}\nStatus: ${v.status}`,
      vacancyId: v.id,
    }));
}

// ---------- stale applications ----------

/** How long before the same silent application is worth mentioning again. A week, not a day: this
 * is the one recurring nudge here with no external trigger, and a daily version reads as nagging. */
export const STALE_REMINDER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Reuses analytics.service.ts#isStaleApplication rather than re-deriving "gone quiet" — the digest
 * email, the dashboard's focus-of-the-week and this notification must agree on the threshold, or a
 * user gets told an application is stale by one surface and not another.
 *
 * Only the single longest-waiting application is returned per run. The digest email is the place
 * for the full list; a chat notification that lists twelve of them is one nobody reads.
 */
export function buildStaleReminders(rows: VacancyReminderRow[], nowMs: number): PendingNotification[] {
  const stale = rows
    .filter((v) => isStaleApplication({ status: v.status, applied: v.applied, next: "" }, nowMs))
    .map((v) => ({ ...v, daysWaiting: Math.floor((nowMs - new Date(v.applied).getTime()) / 86_400_000) }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
  const worst = stale[0];
  if (!worst) return [];
  const others = stale.length - 1;
  return [
    {
      kind: "stale",
      dedupeKey: `stale:${worst.id}`,
      dedupeTtlMs: STALE_REMINDER_TTL_MS,
      text:
        `🕸 No word for ${worst.daysWaiting} days: ${vacancyLabel(worst)}\nWorth a follow-up?` +
        (others > 0 ? `\n\n(${others} other application${others === 1 ? "" : "s"} also waiting)` : ""),
      vacancyId: worst.id,
    },
  ];
}

// ---------- study streak ----------

/** Local hour at which "you haven't studied today" becomes useful rather than premature. Late
 * enough that a normal working day is over, early enough to still act on it. */
export const STREAK_REMINDER_HOUR = 19;

/**
 * Only nudges a streak that actually EXISTS and is about to break — a user with no streak has
 * nothing at stake, and telling them so daily is pure noise. `dueCards` is included in the text
 * only when there are any, so the message never promises work that isn't there.
 */
export function buildStreakReminder(
  streak: StreakState,
  dueCards: number,
  timeZone: string | null,
  nowMs: number,
): PendingNotification | null {
  if (streak.current < 1) return null;
  if (localHourIn(timeZone, nowMs) < STREAK_REMINDER_HOUR) return null;
  const today = localDateIn(timeZone, nowMs);
  if (streak.lastActiveDate === today) return null; // already practiced — nothing at risk
  return {
    kind: "streak",
    // Per local day, so it can fire again tomorrow but never twice in one evening.
    dedupeKey: `streak:${today}`,
    text:
      `🔥 Your ${streak.current}-day streak is still unclaimed today.` +
      (dueCards > 0 ? `\n${dueCards} card${dueCards === 1 ? "" : "s"} due for review.` : ""),
  };
}
