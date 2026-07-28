import express from "express";
import db, { getProfile } from "../../db/index.js";
import { getDynamicKnowledge } from "./knowledge.service.js";
import { kbFor } from "./knowledge-base.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap } from "../../shared/demand.js";

const r = express.Router();

// ---------- personal knowledge base (LLM + cache, fallback to static) ----------
r.get(
  "/knowledge/:tech",
  aiLimiter,
  asyncHandler(async (req, res) => {
    // Express 5: req.params types allow string[] (for repeated path segments),
    // though for "/:tech" the runtime always returns a string.
    const tech = decodeURIComponent(String(req.params.tech));
    res.json(await getDynamicKnowledge(tech, { profile: getProfile(), demand: demandMap() }));
  }),
);

// ---------- dynamic learning plan ----------
r.get("/learn", (_q, res) => {
  const profile = getProfile();
  const demand = demandMap();
  const skills = new Set(profile.skills);
  const gapsSorted = Object.entries(demand)
    .filter(([t]) => !skills.has(t))
    .sort((a, b) => b[1] - a[1]);
  const gaps = gapsSorted.map(([tech, count]) => ({ tech, count, ...kbFor(tech) }));
  const strengths = Object.entries(demand)
    .filter(([t]) => skills.has(t))
    .sort((a, b) => b[1] - a[1])
    .map(([tech, count]) => ({ tech, count }));
  const total = db.prepare("SELECT COUNT(*) c FROM vacancies").get() as { c: number };
  res.json({ gaps, strengths, totalVacancies: total.c });
});
r.post(
  "/learn/plan",
  aiLimiter,
  asyncHandler(async (_req, res) => {
    if (!llmAvailable()) return res.json({ plan: null, offline: true });
    const profile = getProfile();
    const demand = demandMap();
    const skills = new Set(profile.skills);
    const gaps = Object.entries(demand)
      .filter(([t]) => !skills.has(t))
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t} (${c} jobs)`);
    const plan = await chat(
      `You are a mentor for the role "${profile.domain || "professional"}". Be concrete and concise.`,
      `Candidate's skills: ${profile.skills.join(", ")}.\nGaps by market demand priority: ${gaps.join(", ") || "none"}.\nBuild a personal learning plan by phases/days: what to learn first, which topics, how to practice, and in what order to close the gaps.`,
      { maxTokens: 900, cache: true, tier: "smart" },
    );
    res.json({ plan });
  }),
);

export default r;
