// Background job runner + state for the CV Builder's "AI Assistant" (in-depth resume review) —
// previously a single synchronous POST /cv/review call that blocked the button (and, since it's a
// "smart"-tier chatJson call, could take several seconds) with no way to keep using the rest of
// the app meanwhile. Same pattern as vacancies/fetch-all-job.ts: the route just starts this job
// (fire-and-forget) and responds immediately; the client polls GET /cv/review/status for live
// progress, and a global notifier (client/src/shared/cv-review-notifier.tsx) reacts once the job
// leaves "running" even if the user has navigated away from CV Builder in the meantime.
//
// Unlike fetch-all's per-vacancy loop, there's only ONE real unit of work here (reviewCv() itself
// is a single profile+demand+chatJson call) — so the "steps" below are coarse phases around that
// one call, not a fine-grained per-item loop. Still genuinely observable progress, not faked: each
// step transition is written before the async work it describes actually starts.
import { getKvJson, setKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { contextLogger } from "../../core/logger.js";
import { reviewCv, type CvReview } from "./cv-analysis.service.js";

const JOB_KV_KEY = "cvReviewJob";
// A single LLM call should never legitimately run this long — much shorter than fetch-all's
// 10-minute window (that one covers an entire multi-vacancy batch, this is one request).
const STALE_JOB_MS = 3 * 60 * 1000;

export type CvReviewJobStatus = "running" | "done" | "error";
// Exported as an ordered array (not just the union type) so the client can render step 1/2/3
// without hardcoding a second copy of the order.
export const CV_REVIEW_STEPS = ["preparing", "generating_feedback", "finalizing"] as const;
export type CvReviewStep = (typeof CV_REVIEW_STEPS)[number];

export interface CvReviewJobState {
  status: CvReviewJobStatus;
  step: CvReviewStep | null;
  startedAt: string;
  finishedAt?: string;
  /** Top-level failure message — only set when status is "error" (a crash outside reviewCv()'s
   * own offline/failure handling, e.g. the DB connection dropping mid-call). */
  error?: string;
  result?: CvReview & { offline: boolean };
}

export async function getCvReviewJob(userId: UserId): Promise<CvReviewJobState | null> {
  return getKvJson<CvReviewJobState>(userId, JOB_KV_KEY);
}

function isJobActive(job: CvReviewJobState | null): job is CvReviewJobState {
  if (!job || job.status !== "running") return false;
  return Date.now() - new Date(job.startedAt).getTime() < STALE_JOB_MS;
}

/**
 * Starts a fresh CV review job, or returns the already-running one unchanged if the caller
 * double-clicked while one was still in flight — idempotent, never starts two background reviews
 * for the same user at once.
 */
export async function startCvReviewJob(userId: UserId, cvText: string): Promise<CvReviewJobState> {
  const existing = await getCvReviewJob(userId);
  if (isJobActive(existing)) return existing;

  const startedAt = new Date().toISOString();
  const initial: CvReviewJobState = { status: "running", step: "preparing", startedAt };
  await setKvJson(userId, JOB_KV_KEY, initial);
  void runCvReviewJob(userId, cvText, startedAt);
  return initial;
}

async function runCvReviewJob(userId: UserId, cvText: string, startedAt: string): Promise<void> {
  try {
    await setKvJson(userId, JOB_KV_KEY, { status: "running", step: "generating_feedback", startedAt });
    const result = await reviewCv(userId, cvText);
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
    contextLogger().error({ err: e, userId }, "CV review background job crashed");
    await setKvJson(userId, JOB_KV_KEY, {
      status: "error",
      step: null,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: (e as Error).message,
    });
  }
}
