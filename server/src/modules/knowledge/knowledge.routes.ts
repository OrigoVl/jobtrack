import express from "express";
import { getProfile } from "../../db/index.js";
import { getDynamicKnowledge } from "./knowledge.service.js";
import { kbFor } from "./knowledge-base.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap } from "../../shared/demand.js";
import { countVacancies } from "../vacancies/vacancies.repo.js";

const r = express.Router();

// ---------- personal knowledge base (LLM + cache, fallback to static) ----------
r.get(
  "/knowledge/:tech",
  aiLimiter,
  authed(async (userId, req, res) => {
    // Express 5: req.params types allow string[] (for repeated path segments),
    // though for "/:tech" the runtime always returns a string.
    const tech = decodeURIComponent(String(req.params.tech));
    const profile = await getProfile(userId);
    res.json(await getDynamicKnowledge(userId, tech, { profile, demand: await demandMap(userId) }));
  }),
);

// ---------- dynamic learning plan ----------
r.get(
  "/learn",
  authed(async (userId, _req, res) => {
    const profile = await getProfile(userId);
    const demand = await demandMap(userId);
    const skills = new Set(profile.skills);
    const gapsSorted = Object.entries(demand)
      .filter(([t]) => !skills.has(t))
      .sort((a, b) => b[1] - a[1]);
    const gaps = gapsSorted.map(([tech, count]) => ({ tech, count, ...kbFor(tech) }));
    const strengths = Object.entries(demand)
      .filter(([t]) => skills.has(t))
      .sort((a, b) => b[1] - a[1])
      .map(([tech, count]) => ({ tech, count }));
    const total = await countVacancies(userId);
    res.json({ gaps, strengths, totalVacancies: total });
  }),
);
r.post(
  "/learn/plan",
  aiLimiter,
  authed(async (userId, _req, res) => {
    if (!llmAvailable()) return res.json({ plan: null, offline: true });
    const profile = await getProfile(userId);
    const demand = await demandMap(userId);
    const skills = new Set(profile.skills);
    const gaps = Object.entries(demand)
      .filter(([t]) => !skills.has(t))
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t} (${c} jobs)`);
    const plan = await chat(
      userId,
      `You are a mentor for the role "${profile.domain || "professional"}". Be concrete and concise.`,
      `Candidate's skills: ${profile.skills.join(", ")}.\nGaps by market demand priority: ${gaps.join(", ") || "none"}.\nBuild a personal learning plan by phases/days: what to learn first, which topics, how to practice, and in what order to close the gaps.`,
      { maxTokens: 900, cache: true, tier: "smart", feature: "learn-plan" },
    );
    res.json({ plan });
  }),
);

export default r;
