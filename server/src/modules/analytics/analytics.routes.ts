import express from "express";
import { z } from "zod";
import db, { getProfile, getSrsStateByCard, getReachedCounts, getFunnelConversion, getAvgDaysInStage } from "../../db/index.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap } from "../../shared/demand.js";
import { allCards } from "../study/content-store.js";

// `.catch("")` (not .optional()) on `why` — the LLM sometimes omits the field instead of
// returning "": the schema still accepts the response (no repair-retry over this), just
// normalizes it to an empty string, the same as the old manual typeof check used to.
const FocusActionsSchema = z.object({
  actions: z.array(z.object({ title: z.string(), why: z.string().catch("") })).max(3),
});

const r = express.Router();

interface VacancyStatusRow {
  status: string;
  created: string;
  applied: string;
}
interface VacancyStatusNextRow {
  status: string;
  next: string;
  applied: string;
}

// How many days of silence after applying counts as a "gone quiet" vacancy worth nudging the recruiter about.
const STALE_APPLICATION_DAYS = 14;
// Statuses where the candidate is genuinely waiting on a response from the other side (as
// opposed to "Want to apply" — not yet submitted, and the terminal "Offer"/"Rejected"/"Paused" —
// the waiting has deliberately already ended).
const WAITING_STATUSES = ["Applied", "Screening", "Tech interview", "Take-home task", "Final"];

function isStaleApplication(v: VacancyStatusNextRow, nowMs: number): boolean {
  if (!WAITING_STATUSES.includes(v.status) || !v.applied) return false;
  const appliedMs = new Date(v.applied).getTime();
  if (Number.isNaN(appliedMs)) return false;
  return (nowMs - appliedMs) / 86_400_000 > STALE_APPLICATION_DAYS;
}

// ---------- analytics ----------
// "Rejected" is deliberately NOT included in funnelOrder below for conversion/duration: it's a
// terminal "exit" from almost any stage, not the next STEP of the funnel — including it would
// give a false signal like "Final→Rejected conversion 40%", even though Rejected could have
// happened from earlier stages too.
const FUNNEL_ORDER = ["Want to apply", "Applied", "Screening", "Tech interview", "Take-home task", "Final", "Offer", "Rejected"];
const FUNNEL_PROGRESSION_ORDER = FUNNEL_ORDER.filter((s) => s !== "Rejected");

r.get("/analytics", (_q, res) => {
  const rows = db.prepare("SELECT status, created, applied FROM vacancies").all() as unknown as VacancyStatusRow[];
  const funnelOrder = FUNNEL_ORDER;
  const funnel: Record<string, number> = {};
  funnelOrder.forEach((s) => (funnel[s] = 0));
  const byDate: Record<string, number> = {};
  rows.forEach((v) => {
    funnel[v.status] = (funnel[v.status] || 0) + 1;
    const d = v.created || "";
    if (d) byDate[d] = (byDate[d] || 0) + 1;
  });
  // funnel is only the CURRENT distribution (a snapshot of "where the vacancy is now"): a
  // vacancy rejected at the "Tech interview" stage no longer counts there, because the status
  // was overwritten to "Rejected" — it looks like it never got there. funnelReached is how many
  // vacancies EVER had each status (from vacancy_status_history), i.e. an honest funnel of
  // stage progression regardless of the final outcome.
  const reached = getReachedCounts();
  const funnelReached: Record<string, number> = {};
  funnelOrder.forEach((s) => (funnelReached[s] = reached[s] || 0));
  const demand = demandMap();
  const profile = getProfile();
  const radar = Object.entries(demand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tech, cnt]) => ({
      tech,
      demand: cnt,
      you: profile.skills.includes(tech) ? cnt : 0,
    }));
  const conversion = getFunnelConversion(FUNNEL_PROGRESSION_ORDER);
  const stageDurations = getAvgDaysInStage().filter((d) => d.count >= 2); // count===1 is statistically insignificant, just noise in the UI
  res.json({ funnel, funnelReached, byDate, demand, radar, conversion, stageDurations });
});

interface FocusSummary {
  totalVac: number;
  interviews: number;
  overdue: number;
  upcoming: number;
  funnel: Record<string, number>;
  gaps: string[];
  skillsCount: number;
  dueCards: number;
  staleApplications: number;
}

interface FocusAction {
  title: string;
  why: string;
}

// ---------- "Focus of the week": the LLM analyzes the whole state and gives 3 concrete actions ----------
function heuristicFocus(s: FocusSummary): FocusAction[] {
  const actions: FocusAction[] = [];
  if (s.overdue > 0)
    actions.push({
      title: `Update ${s.overdue} overdue steps`,
      why: 'There are vacancies with a "next step" date in the past — don\'t lose the contact.',
    });
  if (s.interviews > 0)
    actions.push({
      title: "Prepare for interviews",
      why: `${s.interviews} vacancies at the interview stage — do a "Mock interview" and review your cards.`,
    });
  if (s.gaps.length > 0)
    actions.push({
      title: `Close the "${s.gaps[0]}" gap`,
      why: "The most in-demand technology on the list that's missing from your profile.",
    });
  if (s.totalVac < 3)
    actions.push({ title: "Add more vacancies", why: "A small sample — import vacancies so the analytics and roadmap are more accurate." });
  if (s.dueCards > 0)
    actions.push({
      title: `Review ${s.dueCards} cards`,
      why: "There are cards due for review today — keep your knowledge fresh with the SRS algorithm.",
    });
  if (s.staleApplications > 0)
    actions.push({
      title: `Nudge ${s.staleApplications} vacancies with no response`,
      why: `More than ${STALE_APPLICATION_DAYS} days of silence after applying — send the recruiter a follow-up or mark it "Rejected" if it's no longer relevant.`,
    });
  return actions.slice(0, 3);
}
r.get(
  "/insights/focus",
  aiLimiter,
  asyncHandler(async (_q, res) => {
    const profile = getProfile();
    const demand = demandMap();
    const rows = db.prepare("SELECT status, next, applied FROM vacancies").all() as unknown as VacancyStatusNextRow[];
    const skills = new Set(profile.skills);
    const gaps = Object.entries(demand)
      .filter(([t]) => !skills.has(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `${t} (${c})`);
    const funnel: Record<string, number> = {};
    rows.forEach((v) => (funnel[v.status] = (funnel[v.status] || 0) + 1));
    const today = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();
    const srs = getSrsStateByCard();
    const summary: FocusSummary = {
      totalVac: rows.length,
      interviews: rows.filter((v) => ["Tech interview", "Take-home task", "Final"].includes(v.status)).length,
      overdue: rows.filter((v) => v.next && v.next < today).length,
      upcoming: rows.filter((v) => v.next && v.next >= today).length,
      funnel,
      gaps,
      skillsCount: skills.size,
      dueCards: allCards().filter((c) => {
        const s = srs[c.id];
        return !s || s.due <= today;
      }).length,
      staleApplications: rows.filter((v) => isStaleApplication(v, nowMs)).length,
    };
    if (!llmAvailable()) return res.json({ offline: true, actions: heuristicFocus(summary) });
    const role = profile.domain || "professional";
    const out = await chatJson(
      `You are a career mentor for a candidate (${role}) job-hunting. You analyze their state and give the 3 most important concrete actions for this week. Reply with ONLY valid JSON in English.`,
      `Search state (JSON): ${JSON.stringify(summary)}.\n` +
        `Give exactly 3 priority actions with an explanation of why now. Format strictly: {"actions":[{"title":"short action","why":"1 sentence why"}]}`,
      FocusActionsSchema,
      // "fast": prioritizing 3 actions from a structured funnel state — a light task, doesn't
      // need "smart"-tier; cheaper and faster for a card the user sees every day.
      { maxTokens: 500, temperature: 0.5, cache: true, tier: "fast" },
    );
    const actions: FocusAction[] = out?.actions ?? [];
    // offline:true when the LLM didn't give valid actions (provider error/timeout/bad JSON even
    // after chatJson's repair-retry) and we show the same heuristic fallback as when
    // llmAvailable()===false above — without this flag the client (FocusWeekCard) couldn't tell
    // a personal AI analysis apart from generic advice.
    res.json(actions.length ? { actions } : { offline: true, actions: heuristicFocus(summary) });
  }),
);

export default r;
