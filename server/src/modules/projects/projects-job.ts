// Background job runner + state for the Pet Projects page's personalized ladder
// (projects.service.ts's getDynamicProjects) — same pattern as cv/cv-audit-job.ts and
// vacancies/fetch-all-job.ts: up to MAX_PERSONAL_PROJECTS parallel smart-tier chatJson calls used
// to run synchronously inside GET /projects, blocking the page's first load on the slowest of
// them with no progress UI. Now the route starts this job fire-and-forget and responds
// immediately with the static ladder; the client re-polls GET /projects (see projects.routes.ts's
// own comment on why that's enough here, unlike the CV audit/fetch-all cases which need a
// dedicated status query) until the personalized cards land.
//
// One difference from those two siblings: the job's `result` is STICKY across runs — starting a
// new run (see startProjectsJob below) carries the previous result forward into the new "running"
// state instead of clearing it, and a run that ends in "error" still preserves whatever the last
// successful run produced. Unlike a CV audit or a fetch-all batch (each a one-off, user-triggered
// action with its own results view), the personalized ladder is the thing GET /projects always
// renders — losing it while a background refresh is in flight, or after a transient failure,
// would flash the page back to the static fallback for no reason.
import { getKvJson, setKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { contextLogger } from "../../core/logger.js";
import { getDynamicProjects, type DynamicProjects, type DynamicProjectsContext } from "./projects.service.js";

const JOB_KV_KEY = "projectsJob";
// A handful of parallel smart-tier calls (not a big per-item loop like fetch-all's) — same order
// of magnitude as cv-audit-job.ts's own STALE_JOB_MS.
const STALE_JOB_MS = 3 * 60 * 1000;

export type ProjectsJobStatus = "running" | "done" | "error";

export interface ProjectsJobState {
  status: ProjectsJobStatus;
  startedAt: string;
  finishedAt?: string;
  /** Top-level failure message — only set when status is "error" (a crash outside
   * getDynamicProjects's own offline/per-slot-failure handling, e.g. the DB connection dropping
   * mid-call). */
  error?: string;
  /** Sticky across runs — see this file's own header comment. Absent only before the very first
   * run has ever completed for this user. */
  result?: DynamicProjects;
}

export async function getProjectsJob(userId: UserId): Promise<ProjectsJobState | null> {
  return getKvJson<ProjectsJobState>(userId, JOB_KV_KEY);
}

function isJobActive(job: ProjectsJobState | null): job is ProjectsJobState {
  if (!job || job.status !== "running") return false;
  return Date.now() - new Date(job.startedAt).getTime() < STALE_JOB_MS;
}

/**
 * Starts a fresh personalization job, or returns the already-running one unchanged if one's still
 * in flight — idempotent, never runs two background generations for the same user at once. Unlike
 * cv-audit-job.ts/fetch-all-job.ts's startXJob, this one is called BOTH automatically (GET
 * /projects, only when there's no result yet — see projects.routes.ts) and explicitly (POST
 * /projects/generate, always starts a fresh run to pick up new gaps/skills) — the caller decides
 * whether "already have a done result" should still count as "nothing to do".
 */
export async function startProjectsJob(userId: UserId, context: DynamicProjectsContext): Promise<ProjectsJobState> {
  const existing = await getProjectsJob(userId);
  // Captured BEFORE the isJobActive() narrowing below — referencing `existing` afterward for its
  // `result` field (rather than for the whole object) trips a real TS narrowing quirk where a
  // user-defined type guard's negative branch collapses the type to `never` instead of `null`.
  const previousResult = existing?.result;
  if (isJobActive(existing)) return existing;

  const startedAt = new Date().toISOString();
  const initial: ProjectsJobState = { status: "running", startedAt, result: previousResult };
  await setKvJson(userId, JOB_KV_KEY, initial);
  void runProjectsJob(userId, context, startedAt);
  return initial;
}

async function runProjectsJob(userId: UserId, context: DynamicProjectsContext, startedAt: string): Promise<void> {
  try {
    const result = await getDynamicProjects(userId, context);
    await setKvJson(userId, JOB_KV_KEY, { status: "done", startedAt, finishedAt: new Date().toISOString(), result });
  } catch (e) {
    // Without this, a crash here (e.g. the DB connection dropping mid-call) would leave the job
    // stuck at "running" until STALE_JOB_MS lets a fresh one start — same reasoning as
    // cv-audit-job.ts/fetch-all-job.ts's own top-level catch. Preserve the last known-good result
    // (if any) rather than clearing it — see this file's header comment.
    contextLogger().error({ err: e, userId }, "Pet projects background job crashed");
    const existing = await getProjectsJob(userId);
    await setKvJson(userId, JOB_KV_KEY, {
      status: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: (e as Error).message,
      result: existing?.result,
    });
  }
}
