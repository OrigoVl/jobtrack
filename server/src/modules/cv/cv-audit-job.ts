// Background job runner + state for the CV Builder's line-by-line audit.
//
// The audit is the app's longest structured LLM call (up to 25 findings, each with a reason AND a
// replacement line), so running it inline would block the button for tens of seconds. Same pattern
// as vacancies/fetch-all-job.ts: the route starts this job fire-and-forget and responds
// immediately, the client polls GET /cv/audit/status, and a global notifier
// (client/src/shared/cv-audit-notifier.tsx) reacts once the job leaves "running" even if the user
// has navigated away from the CV Builder in the meantime.
//
// This machinery previously drove a separate "CV review" call. That review has been folded into
// the audit — it produced a second opinion on the same résumé, at a second call's cost, and the
// two could contradict each other on the same line (the review asked for rewrites "with a metric"
// while the audit treats an unverifiable metric as something to delete). One call, one opinion.
//
// Unlike fetch-all's per-vacancy loop, there's only ONE real unit of work here (auditCv is a
// single chatJson call), so the "steps" below are coarse phases around that one call, not a
// per-item loop. Still genuinely observable progress, not faked: each step transition is written
// before the async work it describes actually starts.
import { getKvJson, setKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { contextLogger } from "../../core/logger.js";
import { auditCv, type CvAuditResult } from "./cv-audit.service.js";
import type { CvDoc } from "./cv.schemas.js";

const JOB_KV_KEY = "cvAuditJob";
// A single LLM call should never legitimately run this long — much shorter than fetch-all's
// 10-minute window (that one covers an entire multi-vacancy batch, this is one request).
const STALE_JOB_MS = 3 * 60 * 1000;

export type CvAuditJobStatus = "running" | "done" | "error";
// Exported as an ordered array (not just the union type) so the client can render step 1/2/3
// without hardcoding a second copy of the order.
export const CV_AUDIT_STEPS = ["preparing", "generating_feedback", "finalizing"] as const;
export type CvAuditStep = (typeof CV_AUDIT_STEPS)[number];

export interface CvAuditJobState {
  status: CvAuditJobStatus;
  step: CvAuditStep | null;
  startedAt: string;
  finishedAt?: string;
  /** Top-level failure message — only set when status is "error" (a crash outside auditCv's own
   * offline/failure handling, e.g. the DB connection dropping mid-call). */
  error?: string;
  result?: CvAuditResult;
}

export async function getCvAuditJob(userId: UserId): Promise<CvAuditJobState | null> {
  return getKvJson<CvAuditJobState>(userId, JOB_KV_KEY);
}

function isJobActive(job: CvAuditJobState | null): job is CvAuditJobState {
  if (!job || job.status !== "running") return false;
  return Date.now() - new Date(job.startedAt).getTime() < STALE_JOB_MS;
}

/**
 * Starts a fresh audit job, or returns the already-running one unchanged if the caller
 * double-clicked while one was still in flight — idempotent, never starts two background audits
 * for the same user at once.
 */
export async function startCvAuditJob(
  userId: UserId,
  doc: CvDoc,
  known: string[] = [],
  demand: Record<string, number> = {},
): Promise<CvAuditJobState> {
  const existing = await getCvAuditJob(userId);
  if (isJobActive(existing)) return existing;

  const startedAt = new Date().toISOString();
  const initial: CvAuditJobState = { status: "running", step: "preparing", startedAt };
  await setKvJson(userId, JOB_KV_KEY, initial);
  void runCvAuditJob(userId, doc, startedAt, known, demand);
  return initial;
}

async function runCvAuditJob(
  userId: UserId,
  doc: CvDoc,
  startedAt: string,
  known: string[],
  demand: Record<string, number>,
): Promise<void> {
  try {
    await setKvJson(userId, JOB_KV_KEY, { status: "running", step: "generating_feedback", startedAt });
    const result = await auditCv(userId, doc, known, demand);
    await setKvJson(userId, JOB_KV_KEY, { status: "running", step: "finalizing", startedAt });
    await setKvJson(userId, JOB_KV_KEY, {
      status: "done",
      step: "finalizing",
      startedAt,
      finishedAt: new Date().toISOString(),
      result,
    });
  } catch (e) {
    // Without this, a crash here (e.g. the DB connection dropping mid-call) would leave the job
    // stuck at "running" until STALE_JOB_MS lets a fresh one start — same reasoning as
    // fetch-all-job.ts's own top-level catch.
    contextLogger().error({ err: e, userId }, "CV audit background job crashed");
    await setKvJson(userId, JOB_KV_KEY, {
      status: "error",
      step: null,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: (e as Error).message,
    });
  }
}
