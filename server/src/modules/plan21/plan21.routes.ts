import express from "express";
import { getProfile, getChecklistProgress, toggleChecklistItem, type Profile } from "../../db/index.js";
import { buildPlan, planDayIds, planGapTechs } from "./plan-builder.service.js";
import { getDynamicKnowledge, type DynamicKnowledge } from "../knowledge/knowledge.service.js";
import { llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { demandMap } from "../../shared/demand.js";

const r = express.Router();

// ---------- fast-track plan (dynamic: from vacancies + CV, topics from /knowledge) ----------
async function gatherGapKnowledge(profile: Profile, demand: Record<string, number>): Promise<Record<string, DynamicKnowledge>> {
  if (!llmAvailable()) return {};
  const techs = planGapTechs({ profile, demand });
  const entries = await Promise.all(
    techs.map(async (tech): Promise<[string, DynamicKnowledge]> => [tech, await getDynamicKnowledge(tech, { profile, demand })]),
  );
  return Object.fromEntries(entries);
}
r.get(
  "/plan21",
  asyncHandler(async (_q, res) => {
    const profile = getProfile();
    const demand = demandMap();
    const knowledgeByTech = await gatherGapKnowledge(profile, demand);
    const phases = buildPlan({ profile, demand, knowledgeByTech });
    res.json({ phases, progress: getChecklistProgress("planProgress"), personalized: true });
  }),
);
r.put(
  "/plan21/progress",
  asyncHandler(async (req, res) => {
    const dayId = String(req.body?.dayId || "");
    const done = Boolean(req.body?.done);
    const profile = getProfile();
    const demand = demandMap();
    const knowledgeByTech = await gatherGapKnowledge(profile, demand);
    const phases = buildPlan({ profile, demand, knowledgeByTech });
    if (!planDayIds(phases).has(dayId)) throw new HttpError(400, `Unknown day: "${dayId}"`);
    res.json({ ok: true, progress: toggleChecklistItem("planProgress", dayId, done) });
  }),
);

export default r;
