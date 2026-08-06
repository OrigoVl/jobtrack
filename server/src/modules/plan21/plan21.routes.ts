import express from "express";
import { getProfile, getChecklistProgress, toggleChecklistItem, type Profile } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { buildPlan, planDayIds, planGapTechs } from "./plan-builder.service.js";
import { getDynamicKnowledge, type DynamicKnowledge } from "../knowledge/knowledge.service.js";
import { llmAvailable } from "../../llm/index.js";
import { HttpError, authed } from "../../core/http.js";
import { demandMap, gapPriorityMap } from "../../shared/demand.js";

const r = express.Router();

// ---------- fast-track plan (dynamic: from vacancies + CV, topics from /knowledge) ----------
async function gatherGapKnowledge(
  userId: UserId,
  profile: Profile,
  demand: Record<string, number>,
  gapPriority: Record<string, number>,
): Promise<Record<string, DynamicKnowledge>> {
  if (!llmAvailable()) return {};
  const techs = planGapTechs({ profile, gapPriority });
  const entries = await Promise.all(
    techs.map(async (tech): Promise<[string, DynamicKnowledge]> => [tech, await getDynamicKnowledge(userId, tech, { profile, demand })]),
  );
  return Object.fromEntries(entries);
}
r.get(
  "/plan21",
  authed(async (userId, _req, res) => {
    const profile = await getProfile(userId);
    const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
    const knowledgeByTech = await gatherGapKnowledge(userId, profile, demand, gapPriority);
    const phases = buildPlan({ profile, demand, gapPriority, knowledgeByTech });
    res.json({ phases, progress: await getChecklistProgress(userId, "planProgress"), personalized: true });
  }),
);
r.put(
  "/plan21/progress",
  authed(async (userId, req, res) => {
    const dayId = String(req.body?.dayId || "");
    const done = Boolean(req.body?.done);
    const profile = await getProfile(userId);
    const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
    const knowledgeByTech = await gatherGapKnowledge(userId, profile, demand, gapPriority);
    const phases = buildPlan({ profile, demand, gapPriority, knowledgeByTech });
    if (!planDayIds(phases).has(dayId)) throw new HttpError(400, `Unknown day: "${dayId}"`);
    res.json({ ok: true, progress: await toggleChecklistItem(userId, "planProgress", dayId, done) });
  }),
);

export default r;
