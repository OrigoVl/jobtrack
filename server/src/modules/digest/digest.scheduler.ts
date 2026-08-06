// Email digest scheduler — a plain `setInterval` started once at server boot (index.ts), same
// shape as saved-searches.scheduler.ts (see that file's top comment for why a queue/worker system
// is out of proportion for this app's scale). Runs frequently (every few hours) but each user is
// only actually emailed once `isDigestDue` says a week has passed since their last digest.
import { sendEmail } from "../../shared/email.js";
import { sendTelegramMessage } from "../../shared/telegram.js";
import { env } from "../../config/env.js";
import { contextLogger } from "../../core/logger.js";
import { getStudyStreak } from "../../db/kv.js";
import { listVacancyDigestRows } from "../vacancies/vacancies.repo.js";
import { getCombinedCalendar } from "../calendar/calendar.service.js";
import { getTelegramChatId } from "../telegram/telegram.repo.js";
import { listDigestEnabledUsers, recordDigestSent, type DigestUserForRun } from "./digest.repo.js";
import {
  isDigestDue,
  buildStaleApplications,
  buildUpcomingItems,
  hasDigestContent,
  digestHtml,
  digestText,
  type DigestContent,
} from "./digest.service.js";

export const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours — the per-user weekly cadence is gated by isDigestDue, not this interval

async function buildDigestContent(userId: DigestUserForRun["userId"], nowMs: number): Promise<DigestContent> {
  const from = new Date(nowMs).toISOString();
  const to = new Date(nowMs + 7 * 86_400_000).toISOString();
  const [staleRows, streak, combined] = await Promise.all([
    listVacancyDigestRows(userId),
    getStudyStreak(userId),
    getCombinedCalendar(userId, { from, to }),
  ]);
  return {
    staleApplications: buildStaleApplications(staleRows, nowMs),
    streak,
    upcoming: buildUpcomingItems({
      vacancyNextSteps: combined.vacancyNextSteps,
      interviewEvents: combined.events.filter((e) => e.type === "interview"),
    }),
  };
}

// Reachable from inside the email itself (not just the in-app toggle at /account) — a recipient
// must be able to opt out without first having to know the setting exists and sign in to find it.
// env.auth.baseUrl is the app's own public origin: in production the same Express server serves
// both the API and the built client (see config/env.ts's clientDistPath), so it's also the
// correct base for a client-side link, not just an API host.
function digestFooter(): string {
  return (
    `<p style="color:#888;font-size:12px;margin-top:16px;">` +
    `You're receiving this because weekly email digests are enabled on your account. ` +
    `<a href="${env.auth.baseUrl}/account">Manage digest preferences</a>.</p>`
  );
}

async function processOneUserDigest(u: DigestUserForRun, nowMs: number): Promise<void> {
  if (!isDigestDue(u.lastSentAt, nowMs)) return;
  const content = await buildDigestContent(u.userId, nowMs);
  // Nothing worth reporting this week — don't email, and don't advance lastSentAt either: the
  // next scheduler tick re-checks this user in a few hours rather than silently waiting a full
  // week, so a stale application that appears the day after a quiet check is still caught soon.
  if (!hasDigestContent(content)) return;
  await sendEmail({ to: u.userEmail, subject: "Your Zorya weekly digest", html: digestHtml(content) + digestFooter() });
  // A separate, independent channel — not a replacement for email. A linked chat id gets the
  // same content, rendered as plain text (see digest.service.ts#digestText's own comment on why
  // it can't just reuse digestHtml's output).
  const chatId = await getTelegramChatId(u.userId);
  if (chatId) await sendTelegramMessage(chatId, digestText(content));
  await recordDigestSent(u.userId);
}

export async function runDigestOnce(nowMs = Date.now()): Promise<void> {
  const users = await listDigestEnabledUsers();
  for (const u of users) {
    try {
      await processOneUserDigest(u, nowMs);
    } catch (err) {
      // One user's digest failing (a bad email address, a transient DB hiccup) must not stop the
      // rest of the batch from running.
      contextLogger().error({ err, userId: u.userId }, "Failed to process one user's digest");
    }
  }
}

/** Starts the recurring job — called once from index.ts at boot. `unref()` so this timer alone
 * never keeps the process alive (the HTTP server already does that); it still fires normally for
 * as long as the process is otherwise running. */
export function startDigestScheduler(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  const timer = setInterval(() => {
    void runDigestOnce().catch((err) => contextLogger().error({ err }, "Digest scheduler run failed"));
  }, intervalMs);
  timer.unref();
  return timer;
}
