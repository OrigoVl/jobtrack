// Pure, DB-free digest computation — split out of digest.scheduler.ts so the "what's due, what's
// worth emailing, what the email says" logic is unit-testable without a live DB/scheduler tick
// (same reasoning as analytics.service.ts/saved-searches.scheduler.ts's diffNewJobs/isFirstRun).
import { isStaleApplication, STALE_APPLICATION_DAYS } from "../analytics/analytics.service.js";
import type { StreakState } from "../../db/kv.js";

export const DIGEST_INTERVAL_DAYS = 7;

/** A user is due for a fresh digest once a week has passed since the last one — or immediately
 * on their very first run (lastSentAt === null). Exported for unit testing. */
export function isDigestDue(lastSentAt: string | null, nowMs: number): boolean {
  if (!lastSentAt) return true;
  return (nowMs - new Date(lastSentAt).getTime()) / 86_400_000 >= DIGEST_INTERVAL_DAYS;
}

// Deliberately its own shape, NOT `extends VacancyStatusNextRow` (analytics.service.ts) — that
// interface carries a `next` field isStaleApplication() never actually reads (only status/applied
// matter for staleness), and listVacancyDigestRows (vacancies.repo.ts) doesn't select `next` at
// all, since the digest's "upcoming" section gets next-steps from getCombinedCalendar instead.
export interface VacancyDigestRow {
  id: number;
  company: string;
  position: string;
  status: string;
  applied: string;
}

export interface StaleApplicationItem {
  id: number;
  company: string;
  position: string;
  daysWaiting: number;
}

/** Pure — which tracked vacancies have gone quiet (same STALE_APPLICATION_DAYS/WAITING_STATUSES
 * threshold analytics.service.ts's "focus of the week" already uses), longest-waiting first. */
export function buildStaleApplications(rows: VacancyDigestRow[], nowMs: number): StaleApplicationItem[] {
  return rows
    .filter((v) => isStaleApplication({ status: v.status, applied: v.applied, next: "" }, nowMs))
    .map((v) => ({
      id: v.id,
      company: v.company,
      position: v.position,
      daysWaiting: Math.floor((nowMs - new Date(v.applied).getTime()) / 86_400_000),
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
}

export interface UpcomingItem {
  label: string;
  date: string;
}

export interface UpcomingSource {
  vacancyNextSteps: { company: string; position: string; date: string }[];
  /** Already filtered to type "interview" by the caller — see digest.scheduler.ts. Calls/deadlines/
   * reminders aren't surfaced here; "upcoming interviews" is deliberately narrower than "everything
   * on the calendar" so the digest stays focused on what this feature is actually for. */
  interviewEvents: { title: string; startAt: string }[];
}

/** Pure — combines a vacancy's own `next` date with upcoming manual interview events into one
 * chronological list for the email body. */
export function buildUpcomingItems(source: UpcomingSource): UpcomingItem[] {
  const fromSteps = source.vacancyNextSteps.map((s) => ({ label: `${s.company} — ${s.position}`, date: s.date }));
  const fromEvents = source.interviewEvents.map((e) => ({ label: e.title || "Interview", date: e.startAt.slice(0, 10) }));
  return [...fromSteps, ...fromEvents].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface DigestContent {
  staleApplications: StaleApplicationItem[];
  streak: StreakState;
  upcoming: UpcomingItem[];
}

/** An empty digest (nothing stale, nothing upcoming) would just be noise — a streak alone isn't
 * reason enough to email someone every week. Exported for unit testing. */
export function hasDigestContent(content: DigestContent): boolean {
  return content.staleApplications.length > 0 || content.upcoming.length > 0;
}

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const MAX_ITEMS = 20;

/** Hand-rolled escaped HTML, no templating lib — same approach as
 * saved-searches.scheduler.ts#digestHtml. */
export function digestHtml(content: DigestContent): string {
  const parts: string[] = [];
  if (content.staleApplications.length > 0) {
    const items = content.staleApplications
      .slice(0, MAX_ITEMS)
      .map((v) => `<li>${esc(v.company)} — ${esc(v.position)} (${v.daysWaiting}d waiting)</li>`)
      .join("");
    const more = content.staleApplications.length > MAX_ITEMS ? `<p>...and ${content.staleApplications.length - MAX_ITEMS} more.</p>` : "";
    parts.push(
      `<p>${content.staleApplications.length} application${content.staleApplications.length === 1 ? "" : "s"} with no response in over ${STALE_APPLICATION_DAYS} days:</p><ul>${items}</ul>${more}`,
    );
  }
  if (content.upcoming.length > 0) {
    const items = content.upcoming
      .slice(0, MAX_ITEMS)
      .map((u) => `<li>${esc(u.date)} — ${esc(u.label)}</li>`)
      .join("");
    parts.push(`<p>Coming up in the next ${DIGEST_INTERVAL_DAYS} days:</p><ul>${items}</ul>`);
  }
  if (content.streak.current > 0) {
    parts.push(`<p>🔥 ${content.streak.current}-day study streak — keep it going!</p>`);
  }
  return parts.join("");
}
