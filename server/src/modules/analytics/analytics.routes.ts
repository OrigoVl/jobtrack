import express from "express";
import { z } from "zod";
import { getProfile, getSrsStateByCard, getReachedCounts, getFunnelConversion, getAvgDaysInStage } from "../../db/index.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap } from "../../shared/demand.js";
import { allCards } from "../study/content-store.js";
import { listVacancyStatusRows, listVacancyStatusNextRows } from "../vacancies/vacancies.repo.js";
import { FUNNEL_PROGRESSION_ORDER, buildAnalyticsSummary, buildFocusSummary, heuristicFocus } from "./analytics.service.js";

// `.catch("")` (not .optional()) on `why` — the LLM sometimes omits the field instead of
// returning "": the schema still accepts the response (no repair-retry over this), just
// normalizes it to an empty string, the same as the old manual typeof check used to.
const FocusActionsSchema = z.object({
  actions: z.array(z.object({ title: z.string(), why: z.string().catch("") })).max(3),
});

const r = express.Router();

// ---------- analytics ----------
r.get(
  "/analytics",
  authed(async (userId, _req, res) => {
    const rows = await listVacancyStatusRows(userId);
    const reached = await getReachedCounts(userId);
    const demand = await demandMap(userId);
    const profile = await getProfile(userId);
    const { funnel, funnelReached, byDate, radar } = buildAnalyticsSummary(rows, reached, demand, profile.skills);
    const conversion = await getFunnelConversion(userId, FUNNEL_PROGRESSION_ORDER);
    const stageDurations = (await getAvgDaysInStage(userId)).filter((d) => d.count >= 2); // count===1 is statistically insignificant, just noise in the UI
    res.json({ funnel, funnelReached, byDate, demand, radar, conversion, stageDurations });
  }),
);

r.get(
  "/insights/focus",
  aiLimiter,
  authed(async (userId, _req, res) => {
    const profile = await getProfile(userId);
    const demand = await demandMap(userId);
    const rows = await listVacancyStatusNextRows(userId);
    const today = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();
    const srs = await getSrsStateByCard(userId);
    const cards = await allCards(userId);
    const dueCards = cards.filter((c) => {
      const s = srs[c.id];
      return !s || s.due <= today;
    }).length;
    const summary = buildFocusSummary({ rows, demand, knownSkills: profile.skills, dueCards, today, nowMs });
    if (!llmAvailable()) return res.json({ offline: true, actions: heuristicFocus(summary) });
    const role = profile.domain || "professional";
    const out = await chatJson(
      userId,
      `You are a career mentor for a candidate (${role}) job-hunting. You analyze their state and give the 3 most important concrete actions for this week. Reply with ONLY valid JSON.`,
      `Search state (JSON): ${JSON.stringify(summary)}.\n` +
        `Give exactly 3 priority actions with an explanation of why now. Format strictly: {"actions":[{"title":"short action","why":"1 sentence why"}]}`,
      FocusActionsSchema,
      // "fast": prioritizing 3 actions from a structured funnel state — a light task, doesn't
      // need "smart"-tier; cheaper and faster for a card the user sees every day.
      { maxTokens: 500, temperature: 0.5, cache: true, tier: "fast", feature: "focus-actions", outputLocale: "app" },
    );
    const actions = out?.actions ?? [];
    // offline:true when the LLM didn't give valid actions (provider error/timeout/bad JSON even
    // after chatJson's repair-retry) and we show the same heuristic fallback as when
    // llmAvailable()===false above — without this flag the client (FocusWeekCard) couldn't tell
    // a personal AI analysis apart from generic advice.
    res.json(actions.length ? { actions } : { offline: true, actions: heuristicFocus(summary) });
  }),
);

export default r;
