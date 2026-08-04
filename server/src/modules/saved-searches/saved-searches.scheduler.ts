// Job alerts scheduler — a plain `setInterval` started once at server boot (index.ts), NOT a
// queue/worker system (no BullMQ/Redis): this app treats a heavier tool as something to add only
// once scale actually demands it (see core/rate-limit.ts's in-memory counters, admin's
// pre-aggregation), and "re-check a handful of saved searches every few hours" doesn't come
// close to that bar yet. Every run re-fetches the SAME aggregators /jobs/search already uses
// (job-search.service.ts) — no separate scraping logic to maintain.
import { fetchRemotive, fetchArbeitnow, fetchDou, type RawJob } from "../jobs/job-search.service.js";
import { sendEmail } from "../../shared/email.js";
import { contextLogger } from "../../core/logger.js";
import { getProfile } from "../../db/index.js";
import { extractTechs } from "../../shared/tech-dict.js";
import { computeFit } from "../vacancies/vacancy-text.js";
import type { Fit } from "../../shared/validation.js";
import { listAllSavedSearches, recordRunResult, type SavedSearchForRun } from "./saved-searches.repo.js";

export const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
// Caps how many URLs one saved search remembers — jsonb, not a child table (see schema/app.ts),
// so this keeps a single row from growing without bound over months of runs.
const MAX_TRACKED_URLS = 500;

export async function fetchJobsForRegion(query: string, region: string): Promise<RawJob[]> {
  const wantUa = region === "all" || region === "ua";
  const wantRemote = region === "all" || region === "remote";
  const [dou, remotive, arbeitnow] = await Promise.all([
    wantUa ? fetchDou(query) : Promise.resolve([]),
    wantRemote ? fetchRemotive(query) : Promise.resolve([]),
    wantRemote ? fetchArbeitnow(query) : Promise.resolve([]),
  ]);
  return [...dou, ...remotive, ...arbeitnow];
}

export interface DiffResult {
  newJobs: RawJob[];
  nextSeenUrls: string[];
}

/** Pure — given a fresh fetch and what was seen last time, which postings are new and what the
 * updated "seen" set should be (capped at MAX_TRACKED_URLS, most recent first). Exported for
 * unit testing without any network/DB access. */
export function diffNewJobs(jobs: RawJob[], lastSeenUrls: string[]): DiffResult {
  const seen = new Set(lastSeenUrls);
  const newJobs = jobs.filter((j) => j.url && !seen.has(j.url));
  const nextSeenUrls = Array.from(new Set([...jobs.map((j) => j.url).filter(Boolean), ...lastSeenUrls])).slice(0, MAX_TRACKED_URLS);
  return { newJobs, nextSeenUrls };
}

/** A saved search that has never run before (empty `lastSeenUrls` AND never notified) shouldn't
 * email the user every currently-matching posting as if it just "appeared" — that's not what
 * "alert me to NEW postings" means on day one. First run silently baselines instead. Exported
 * for unit testing. */
export function isFirstRun(search: Pick<SavedSearchForRun, "lastSeenUrls" | "lastNotifiedAt">): boolean {
  return search.lastSeenUrls.length === 0 && search.lastNotifiedAt === null;
}

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export interface RankedJob extends RawJob {
  fit: Fit;
}

// Same offline heuristic vacancies.repo.ts's enrichment path uses (vacancy-text.ts#computeFit) —
// no LLM call needed for a background job ranking a whole batch of postings, and this runs with
// no request latency budget anyway. A raw job-search result has no separately-fetched posting
// text (unlike an already-tracked vacancy), so techs are extracted from the position title + the
// source's own tags (job.tags — populated by Remotive/Arbeitnow, always empty for DOU's scraped
// HTML) instead.
//
// computeFit([], []) intentionally returns "high" ("no known requirements — no basis to lower the
// score"), which is the right call for an ALREADY-TRACKED vacancy that just hasn't been analyzed
// yet, but wrong here: a posting with literally nothing extractable (e.g. a non-technical DOU
// listing) would incorrectly rank ahead of postings with real matched skills. Treated as "low"
// instead so zero-signal postings sink to the bottom rather than falsely topping the list.
export function rankJobsByFit(jobs: RawJob[], skills: string[]): RankedJob[] {
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  const withFit = jobs.map((job) => {
    const techs = extractTechs(`${job.position} ${job.tags.join(" ")}`).map((t) => t.name);
    if (techs.length === 0) return { ...job, fit: "low" as Fit };
    const match = techs.filter((t) => skillSet.has(t.toLowerCase()));
    const gap = techs.filter((t) => !skillSet.has(t.toLowerCase()));
    return { ...job, fit: computeFit(match, gap) };
  });
  const fitRank: Record<Fit, number> = { high: 0, med: 1, low: 2 };
  return [...withFit].sort((a, b) => fitRank[a.fit] - fitRank[b.fit]); // stable — ties keep source order
}

function digestHtml(search: SavedSearchForRun, newJobs: RankedJob[]): string {
  const label = search.label || search.query;
  const items = newJobs
    .slice(0, 25)
    .map(
      (j) =>
        `<li>${j.fit === "high" ? "🎯 " : ""}<a href="${esc(j.url)}">${esc(j.position)}</a> — ${esc(j.company)} (${esc(j.location)})</li>`,
    )
    .join("");
  const more = newJobs.length > 25 ? `<p>...and ${newJobs.length - 25} more.</p>` : "";
  return (
    `<p>${newJobs.length} new posting${newJobs.length === 1 ? "" : "s"} for your saved search "${esc(label)}"` +
    `${newJobs.some((j) => j.fit === "high") ? " (🎯 = strong match with your profile)" : ""}:</p>` +
    `<ul>${items}</ul>${more}`
  );
}

async function processOneSavedSearch(search: SavedSearchForRun): Promise<void> {
  const jobs = await fetchJobsForRegion(search.query, search.region);
  const { newJobs, nextSeenUrls } = diffNewJobs(jobs, search.lastSeenUrls);
  const firstRun = isFirstRun(search);
  const notify = !firstRun && newJobs.length > 0;
  if (notify) {
    const profile = await getProfile(search.userId);
    const ranked = rankJobsByFit(newJobs, profile.skills);
    await sendEmail({
      to: search.userEmail,
      subject: `${newJobs.length} new job${newJobs.length === 1 ? "" : "s"} for "${search.label || search.query}"`,
      html: digestHtml(search, ranked),
    });
  }
  await recordRunResult(search.id, nextSeenUrls, notify);
}

export async function runSavedSearchesOnce(): Promise<void> {
  const searches = await listAllSavedSearches();
  for (const search of searches) {
    try {
      await processOneSavedSearch(search);
    } catch (err) {
      // One saved search failing (a flaky aggregator, an expired address) must not stop the
      // rest of the batch from running.
      contextLogger().error({ err, savedSearchId: search.id }, "Failed to process one saved search");
    }
  }
}

/** Starts the recurring job — called once from index.ts at boot. `unref()` so this timer alone
 * never keeps the process alive (the HTTP server already does that); it still fires normally for
 * as long as the process is otherwise running. */
export function startSavedSearchesScheduler(intervalMs = DEFAULT_INTERVAL_MS): NodeJS.Timeout {
  const timer = setInterval(() => {
    void runSavedSearchesOnce().catch((err) => contextLogger().error({ err }, "Saved-searches scheduler run failed"));
  }, intervalMs);
  timer.unref();
  return timer;
}
