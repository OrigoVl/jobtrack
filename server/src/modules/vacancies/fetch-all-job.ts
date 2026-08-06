// Background job runner + state for "re-analyze every vacancy with a URL" (the Analyzer page's
// "Проаналізувати всі вакансії" button). Previously this ran as a single synchronous loop inside
// the POST /vacancies/fetch-all handler — for a user with 20+ tracked vacancies that's 30-90+
// seconds on one blocking HTTP request with zero feedback in between. Now the route just starts
// this job (fire-and-forget) and responds immediately; the client polls GET
// /vacancies/fetch-all/status for live progress.
//
// State is persisted in the existing per-user `user_kv` table (db/kv.ts's getKvJson/setKvJson) —
// no new schema/migration, no queue/worker system (BullMQ/Redis/SSE): this app's stated bias is
// toward small hand-rolled solutions until scale actually demands more (see
// saved-searches.scheduler.ts's own doc comment for the same reasoning). Persisting in Postgres
// (not just an in-memory map) means the job survives a server restart in a well-defined way (see
// STALE_JOB_MS below) and the user sees their last completed batch again even after fully closing
// and reopening the browser.
import { getKvJson, setKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import type { Fit } from "../../shared/validation.js";
import { contextLogger } from "../../core/logger.js";
import { fetchVacancyText, quickAnalyze } from "./vacancy-analysis.service.js";
import { listVacanciesWithUrl, updateVacancyEnrichment } from "./vacancies.repo.js";

const JOB_KV_KEY = "fetchAllJob";
// If a job is still "running" past this age, treat it as crashed/stuck (e.g. the server
// restarted mid-loop, which would otherwise leave it "running" forever with no writer left to
// ever finish it) — a fresh start is allowed instead of the button staying disabled forever.
const STALE_JOB_MS = 10 * 60 * 1000;
// Same "polite pause" convention as /vacancies/import and /vacancies/import-json's enrichment loops.
const POLITE_PAUSE_MS = 400;

export type FetchAllJobStatus = "running" | "done" | "error";

export interface FetchAllItemResult {
  id: number;
  company: string;
  techs?: string[];
  level?: string;
  /** Already-known skills this vacancy needs (overlaps the candidate's profile) — computed by
   * quickAnalyze() but previously discarded before this job existed. */
  match?: string[];
  /** Skills this vacancy needs that the candidate's profile doesn't have yet. */
  gap?: string[];
  fit?: Fit;
  error?: string;
}

export interface FetchAllJobState {
  status: FetchAllJobStatus;
  total: number;
  processed: number;
  results: FetchAllItemResult[];
  startedAt: string;
  finishedAt?: string;
  /** Top-level failure message — only set when status is "error" (a crash outside the per-item
   * try/catch below, e.g. the DB connection itself dropping mid-loop). */
  error?: string;
}

export async function getFetchAllJob(userId: UserId): Promise<FetchAllJobState | null> {
  return getKvJson<FetchAllJobState>(userId, JOB_KV_KEY);
}

function isJobActive(job: FetchAllJobState | null): job is FetchAllJobState {
  if (!job || job.status !== "running") return false;
  return Date.now() - new Date(job.startedAt).getTime() < STALE_JOB_MS;
}

/**
 * Starts a fresh fetch-all job, or returns the already-running one unchanged if the caller
 * double-clicked/re-opened the page while one was still in flight — idempotent, never starts two
 * background loops for the same user at once.
 */
export async function startFetchAllJob(userId: UserId): Promise<FetchAllJobState> {
  const existing = await getFetchAllJob(userId);
  if (isJobActive(existing)) return existing;

  const rows = await listVacanciesWithUrl(userId);
  const startedAt = new Date().toISOString();
  const initial: FetchAllJobState = rows.length
    ? { status: "running", total: rows.length, processed: 0, results: [], startedAt }
    : { status: "done", total: 0, processed: 0, results: [], startedAt, finishedAt: startedAt };
  await setKvJson(userId, JOB_KV_KEY, initial);
  if (rows.length) void runFetchAllJob(userId, rows, startedAt);
  return initial;
}

async function runFetchAllJob(userId: UserId, rows: Awaited<ReturnType<typeof listVacanciesWithUrl>>, startedAt: string): Promise<void> {
  const results: FetchAllItemResult[] = [];
  try {
    for (const v of rows) {
      try {
        const text = await fetchVacancyText(v.url);
        if (text.length < 200) {
          results.push({ id: v.id, company: v.company, error: "empty/unavailable" });
        } else {
          const a = await quickAnalyze(userId, text);
          await updateVacancyEnrichment(userId, v.id, { stack: a.techs, level: a.level || v.level, fit: a.fit });
          results.push({ id: v.id, company: v.company, techs: a.techs, level: a.level, match: a.match, gap: a.gap, fit: a.fit });
        }
      } catch (e) {
        results.push({ id: v.id, company: v.company, error: (e as Error).message });
      }
      // Written after EVERY item (not just at the end) so a poll mid-run sees live progress —
      // this is the whole point of moving the loop out of the request/response cycle.
      await setKvJson(userId, JOB_KV_KEY, { status: "running", total: rows.length, processed: results.length, results, startedAt });
      await new Promise((resolve) => setTimeout(resolve, POLITE_PAUSE_MS));
    }
    const failed = results.filter((r) => r.error).length;
    // Same reasoning as the old route handler's log: per-item errors are only visible in the
    // results array, an aggregate log is needed to notice a systemic problem (e.g. a source
    // started blocking scraping en masse) rather than guessing from individual rows in the UI.
    if (failed > 0) contextLogger().warn({ processed: results.length, failed }, "Bulk vacancy re-parse: some URLs failed");
    await setKvJson(userId, JOB_KV_KEY, {
      status: "done",
      total: rows.length,
      processed: results.length,
      results,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (e) {
    // A failure OUTSIDE the per-item try/catch above (e.g. the DB connection itself dropping) —
    // without this, the job would stay stuck at "running" until STALE_JOB_MS lets a new one start.
    contextLogger().error({ err: e, userId }, "Bulk vacancy re-parse: background job crashed");
    await setKvJson(userId, JOB_KV_KEY, {
      status: "error",
      total: rows.length,
      processed: results.length,
      results,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: (e as Error).message,
    });
  }
}
