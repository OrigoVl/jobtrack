import express from "express";
import db, { getProfile, getSrsStateByCard } from "../../db/index.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap } from "../../shared/demand.js";
import { allCards } from "../study/content-store.js";

const r = express.Router();

interface VacancyStatusRow {
  status: string;
  created: string;
  applied: string;
}
interface VacancyStatusNextRow {
  status: string;
  next: string;
}

// ---------- analytics ----------
r.get("/analytics", (_q, res) => {
  const rows = db.prepare("SELECT status, created, applied FROM vacancies").all() as unknown as VacancyStatusRow[];
  const funnelOrder = ["Хочу подати", "Відправив CV", "Скринінг", "Тех.співбесіда", "Тестове завдання", "Фінал", "Оффер", "Відмова"];
  const funnel: Record<string, number> = {};
  funnelOrder.forEach((s) => (funnel[s] = 0));
  const byDate: Record<string, number> = {};
  rows.forEach((v) => {
    funnel[v.status] = (funnel[v.status] || 0) + 1;
    const d = v.created || "";
    if (d) byDate[d] = (byDate[d] || 0) + 1;
  });
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
  res.json({ funnel, byDate, demand, radar });
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
}

interface FocusAction {
  title: string;
  why: string;
}

// ---------- «Фокус тижня»: LLM аналізує весь стан і дає 3 конкретні дії ----------
function heuristicFocus(s: FocusSummary): FocusAction[] {
  const actions: FocusAction[] = [];
  if (s.overdue > 0)
    actions.push({
      title: `Онови ${s.overdue} прострочених кроків`,
      why: "Є вакансії з датою «наступний крок» у минулому — не втрачай контакт.",
    });
  if (s.interviews > 0)
    actions.push({
      title: "Готуйся до співбесід",
      why: `${s.interviews} вакансій на етапі співбесіди — пройди «Мок-інтерв'ю» й повтори картки.`,
    });
  if (s.gaps.length > 0)
    actions.push({ title: `Закрий прогалину «${s.gaps[0]}»`, why: "Найзатребуваніша технологія зі списку, якої немає у твоєму профілі." });
  if (s.totalVac < 3)
    actions.push({ title: "Додай більше вакансій", why: "Мала вибірка — імпортуй вакансії, щоб аналітика й роудмапа були точнішими." });
  if (s.dueCards > 0)
    actions.push({
      title: `Повтори ${s.dueCards} карток`,
      why: "Є картки до повторення сьогодні — тримай знання свіжими за алгоритмом SRS.",
    });
  return actions.slice(0, 3);
}
r.get(
  "/insights/focus",
  aiLimiter,
  asyncHandler(async (_q, res) => {
    const profile = getProfile();
    const demand = demandMap();
    const rows = db.prepare("SELECT status, next FROM vacancies").all() as unknown as VacancyStatusNextRow[];
    const skills = new Set(profile.skills);
    const gaps = Object.entries(demand)
      .filter(([t]) => !skills.has(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `${t} (${c})`);
    const funnel: Record<string, number> = {};
    rows.forEach((v) => (funnel[v.status] = (funnel[v.status] || 0) + 1));
    const today = new Date().toISOString().slice(0, 10);
    const srs = getSrsStateByCard();
    const summary: FocusSummary = {
      totalVac: rows.length,
      interviews: rows.filter((v) => ["Тех.співбесіда", "Тестове завдання", "Фінал"].includes(v.status)).length,
      overdue: rows.filter((v) => v.next && v.next < today).length,
      upcoming: rows.filter((v) => v.next && v.next >= today).length,
      funnel,
      gaps,
      skillsCount: skills.size,
      dueCards: allCards().filter((c) => {
        const s = srs[c.id];
        return !s || s.due <= today;
      }).length,
    };
    if (!llmAvailable()) return res.json({ offline: true, actions: heuristicFocus(summary) });
    const role = profile.domain || "фахівець";
    const out = await chat(
      `Ти кар'єрний ментор для кандидата (${role}) у пошуку роботи. Аналізуєш його стан і даєш 3 найважливіші конкретні дії на цей тиждень. Відповідай ЛИШЕ валідним JSON українською.`,
      `Стан пошуку (JSON): ${JSON.stringify(summary)}.\n` +
        `Дай рівно 3 пріоритетні дії з поясненням чому саме зараз. Формат строго: {"actions":[{"title":"коротка дія","why":"1 речення чому"}]}`,
      { json: true, maxTokens: 500, temperature: 0.5, cache: true, tier: "smart" },
    );
    const actions: FocusAction[] = Array.isArray(out?.actions)
      ? out.actions
          .filter((a: unknown): a is { title: string; why?: unknown } => !!a && typeof (a as { title?: unknown }).title === "string")
          .map((a: { title: string; why?: unknown }) => ({ title: a.title, why: typeof a.why === "string" ? a.why : "" }))
          .slice(0, 3)
      : [];
    res.json({ actions: actions.length ? actions : heuristicFocus(summary) });
  }),
);

export default r;
