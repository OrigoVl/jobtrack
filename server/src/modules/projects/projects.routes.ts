import express from "express";
import { getChecklistProgress, getProfile, toggleChecklistItem } from "../../db/index.js";
import { getDynamicProjects } from "./projects.service.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap, gapPriorityMap } from "../../shared/demand.js";

const r = express.Router();

// ---------- pet projects (dynamic: personalized to the candidate's own gaps, see
// projects.service.ts; aiLimiter on both routes since either can trigger a real LLM call the
// first time a given gap/skillset combination is seen — same guard as /knowledge/:tech) ----------
r.get(
  "/projects",
  aiLimiter,
  authed(async (userId, _req, res) => {
    const profile = await getProfile(userId);
    const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
    const { projects, personalized } = await getDynamicProjects(userId, { profile, demand, gapPriority });
    res.json({ projects, progress: await getChecklistProgress(userId, "projectProgress"), personalized });
  }),
);
r.put(
  "/projects/progress",
  aiLimiter,
  authed(async (userId, req, res) => {
    const itemId = String(req.body?.itemId || "");
    const done = Boolean(req.body?.done);
    const profile = await getProfile(userId);
    const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
    const { projects } = await getDynamicProjects(userId, { profile, demand, gapPriority });
    const valid = projects.some((p) => p.dod.some((d) => d.id === itemId));
    if (!valid) throw new HttpError(400, `Unknown item: "${itemId}"`);
    res.json({ ok: true, progress: await toggleChecklistItem(userId, "projectProgress", itemId, done) });
  }),
);

export default r;
