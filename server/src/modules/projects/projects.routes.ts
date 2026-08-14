import express from "express";
import { getChecklistProgress, getProfile, toggleChecklistItem } from "../../db/index.js";
import type { DynamicProjectsContext } from "./projects.service.js";
import { getProjectsJob, startProjectsJob, type ProjectsJobState } from "./projects-job.js";
import { PROJECTS, type Project } from "./projects.data.js";
import { PROJECTS_UK } from "./projects.data.uk.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap, gapPriorityMap } from "../../shared/demand.js";
import { getLocale } from "../../core/request-context.js";
import type { UserId } from "../../db/user-id.js";

const r = express.Router();

async function buildContext(userId: UserId): Promise<DynamicProjectsContext> {
  const profile = await getProfile(userId);
  const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
  return { profile, demand, gapPriority };
}

/** What GET /projects and PUT /projects/progress both render: the sticky personalized result if
 * one exists yet, otherwise the static ladder — see projects-job.ts's own header comment on why
 * the result is sticky across runs. */
function currentProjects(job: ProjectsJobState | null): Project[] {
  return job?.result?.projects ?? (getLocale() === "uk" ? PROJECTS_UK : PROJECTS);
}

// ---------- pet projects (dynamic: personalized to the candidate's own gaps, see
// projects.service.ts/projects-job.ts) ----------
r.get(
  "/projects",
  aiLimiter,
  authed(async (userId, _req, res) => {
    const context = await buildContext(userId);
    let job = await getProjectsJob(userId);
    // Auto-kick the FIRST generation (or retry one that crashed before ever producing a result) —
    // deliberately does NOT re-trigger on every page load once a personalized result exists, so
    // visiting this page repeatedly doesn't spawn a fresh multi-call generation each time. An
    // explicit refresh goes through POST /projects/generate instead.
    if (!job || (job.status === "error" && !job.result)) job = await startProjectsJob(userId, context);
    res.json({
      projects: currentProjects(job),
      progress: await getChecklistProgress(userId, "projectProgress"),
      personalized: job.result?.personalized ?? false,
      // The client re-polls this same GET while true (see shared/queries/projects.ts) instead of
      // needing a separate status query — there's no user-initiated "start" gesture to react to
      // here, unlike the CV audit/fetch-all jobs, so the page's own data query already doubles as
      // both trigger and progress source.
      generating: job.status === "running",
    });
  }),
);
// Explicit refresh — e.g. after the candidate's skills/tracked vacancies changed enough that the
// gap selection itself should be recomputed, not just re-read from the sticky result above.
r.post(
  "/projects/generate",
  aiLimiter,
  authed(async (userId, _req, res) => {
    const job = await startProjectsJob(userId, await buildContext(userId));
    res.status(202).json(job);
  }),
);
// Polled while an explicit refresh (above) is running — deliberately NOT behind aiLimiter, same
// reasoning as GET /vacancies/fetch-all/status and GET /cv/audit/status.
r.get(
  "/projects/generate/status",
  authed(async (userId, _req, res) => {
    res.json(await getProjectsJob(userId));
  }),
);
r.put(
  "/projects/progress",
  authed(async (userId, req, res) => {
    const itemId = String(req.body?.itemId || "");
    const done = Boolean(req.body?.done);
    const projects = currentProjects(await getProjectsJob(userId));
    const valid = projects.some((p) => p.dod.some((d) => d.id === itemId));
    if (!valid) throw new HttpError(400, `Unknown item: "${itemId}"`);
    res.json({ ok: true, progress: await toggleChecklistItem(userId, "projectProgress", itemId, done) });
  }),
);

export default r;
