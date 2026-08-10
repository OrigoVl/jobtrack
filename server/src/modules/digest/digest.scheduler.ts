// Email digest scheduler — a plain `setInterval` started once at server boot (index.ts), same
// shape as saved-searches.scheduler.ts (see that file's top comment for why a queue/worker system
// is out of proportion for this app's scale). Runs frequently (every few hours) but each user is
// only actually emailed once `isDigestDue` says a week has passed since their last digest.
import { sendEmail } from "../../shared/email.js";
import { notify } from "../../shared/notify.js";
import { env } from "../../config/env.js";
import { contextLogger } from "../../core/logger.js";
import { getStudyStreak } from "../../db/kv.js";
import { withAdvisoryLock } from "../../db/index.js";
import { listVacancyDigestRows } from "../vacancies/vacancies.repo.js";
import { getCombinedCalendar } from "../calendar/calendar.service.js";
import { listDigestEnabledUsers, recordDigestSent, type DigestUserForRun } from "./digest.repo.js";
import { qualifyPendingReferrals } from "../referrals/referrals.service.js";
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

// Arbitrary but must stay unique among any pg_advisory_lock keys in this codebase — the only
// other one currently in use is saved-searches.scheduler.ts's SAVED_SEARCHES_SCHEDULER_LOCK_KEY.
const DIGEST_SCHEDULER_LOCK_KEY = 72_701_001;

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
  // A separate, independent channel — not a replacement for email, which is why the email above is
  // sent unconditionally and this is the only part a `digest` opt-out can switch off. Goes through
  // notify() rather than calling the Bot API directly so it picks up the per-kind preference and
  // the blocked-chat cleanup for free; the plain-text rendering is still its own (see
  // digest.service.ts#digestText's comment on why it can't reuse digestHtml's output).
  await notify(u.userId, { kind: "digest", text: digestText(content) });
  await recordDigestSent(u.userId);
}

export async function runDigestOnce(nowMs = Date.now()): Promise<void> {
  // Unrelated to digests, but deliberately piggybacked on this existing 12h tick rather than a
  // third setInterval (see referrals.service.ts#qualifyPendingReferrals) — one failure here must
  // never block the actual digest run below.
  await qualifyPendingReferrals(nowMs).catch((err) => contextLogger().error({ err }, "Referral qualification sweep failed"));
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
    // With 2+ replicas, every replica's own `setInterval` fires independently — the advisory
    // lock ensures only one replica's tick actually runs `runDigestOnce()`, so a user never gets
    // the same weekly digest email/Telegram alert duplicated once per replica.
    void withAdvisoryLock(DIGEST_SCHEDULER_LOCK_KEY, () => runDigestOnce()).catch((err) =>
      contextLogger().error({ err }, "Digest scheduler run failed"),
    );
  }, intervalMs);
  timer.unref();
  return timer;
}
