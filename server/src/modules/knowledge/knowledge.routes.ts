import express from "express";
import { getProfile } from "../../db/index.js";
import { getDynamicKnowledge } from "./knowledge.service.js";
import { kbFor } from "./knowledge-base.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap, gapPriorityMap, topGapTechs } from "../../shared/demand.js";
import { countVacancies } from "../vacancies/vacancies.repo.js";
import { effectiveTrack } from "../../shared/tracks.js";

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
    const skills = new Set(profile.skills);
    const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
    // Ranked by gapPriority (which gap unlocks the most vacancies), not raw demand (which merely
    // mentions it most) — see shared/demand.ts's computeGapPriority for why the two can disagree.
    const track = effectiveTrack(profile);
    const gaps = topGapTechs(profile.skills, gapPriority).map((tech) => ({ tech, count: demand[tech] || 0, ...kbFor(tech, track) }));
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
    const [demand, gapPriority] = await Promise.all([demandMap(userId), gapPriorityMap(userId, profile.skills)]);
    const gaps = topGapTechs(profile.skills, gapPriority).map((tech) => `${tech} (${demand[tech] || 0} jobs)`);
    const plan = await chat(
      userId,
      `You are a mentor for the role "${profile.domain || "professional"}". Be concrete and concise.`,
      `Candidate's skills: ${profile.skills.join(", ")}.\nGaps by market demand priority: ${gaps.join(", ") || "none"}.\nBuild a personal learning plan by phases/days: what to learn first, which topics, how to practice, and in what order to close the gaps.`,
      // outputLocale: "app" — this is feedback/advice shown in the user's own UI (same reasoning
      // as reviewCv/matchCv/getDynamicKnowledge/resources' focus+actions), not resume/document
      // text that must follow the CV's own language.
      // maxTokens 3000 (not 900) — a multi-phase, multi-week markdown curriculum (see
      // learn.tsx's rendered output) runs far longer than 900 tokens; chat() (unlike chatJson)
      // has no truncation detection/repair-retry, so a too-low limit doesn't error, it just
      // silently hands back a plan cut off mid-sentence — exactly the reported symptom.
      { maxTokens: 3000, cache: true, tier: "smart", feature: "learn-plan", outputLocale: "app" },
    );
    res.json({ plan });
  }),
);

export default r;
