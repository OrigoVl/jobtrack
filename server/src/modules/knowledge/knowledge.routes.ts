import express from "express";
import db, { getProfile } from "../../db/index.js";
import { getDynamicKnowledge } from "./knowledge.service.js";
import { kbFor } from "./knowledge-base.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { demandMap } from "../../shared/demand.js";

const r = express.Router();

// ---------- персональна база знань (LLM + кеш, fallback на статичну) ----------
r.get(
  "/knowledge/:tech",
  asyncHandler(async (req, res) => {
    const tech = decodeURIComponent(req.params.tech);
    res.json(await getDynamicKnowledge(tech, { profile: getProfile(), demand: demandMap() }));
  }),
);

// ---------- динамічний план навчання ----------
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
  asyncHandler(async (_req, res) => {
    if (!llmAvailable()) return res.json({ plan: null, offline: true });
    const profile = getProfile();
    const demand = demandMap();
    const skills = new Set(profile.skills);
    const gaps = Object.entries(demand)
      .filter(([t]) => !skills.has(t))
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t} (${c} вак.)`);
    const plan = await chat(
      `Ти ментор для ролі «${profile.domain || "фахівець"}». Українською, конкретно, стисло.`,
      `Навички кандидата: ${profile.skills.join(", ")}.\nПрогалини за пріоритетом попиту ринку: ${gaps.join(", ") || "немає"}.\nСклади персональний навчальний план по фазах/днях: що вчити спершу, які теми, як тренуватись і в якому порядку закривати прогалини.`,
      { maxTokens: 900, cache: true, tier: "smart" },
    );
    res.json({ plan });
  }),
);

export default r;
