import express from "express";
import { z } from "zod";
import db, { getProfile, getSrsStateByCard, getReachedCounts, getFunnelConversion, getAvgDaysInStage } from "../../db/index.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { demandMap } from "../../shared/demand.js";
import { allCards } from "../study/content-store.js";

// `.catch("")` (не .optional()) на `why` — LLM іноді пропускає поле замість повертати "": схема
// все одно приймає відповідь (не йде в repair-retry за це), просто нормалізує до порожнього рядка,
// як і робила стара ручна typeof-перевірка нижче.
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

// Скільки днів тиші після подачі вважати "затихлою" вакансією, вартою поштовху рекрутеру.
const STALE_APPLICATION_DAYS = 14;
// Статуси, де кандидат реально чекає на реакцію іншої сторони (на відміну від "Хочу подати" —
// ще не подано, і термінальних "Оффер"/"Відмова"/"Пауза" — очікування вже завершене свідомо).
const WAITING_STATUSES = ["Відправив CV", "Скринінг", "Тех.співбесіда", "Тестове завдання", "Фінал"];

function isStaleApplication(v: VacancyStatusNextRow, nowMs: number): boolean {
  if (!WAITING_STATUSES.includes(v.status) || !v.applied) return false;
  const appliedMs = new Date(v.applied).getTime();
  if (Number.isNaN(appliedMs)) return false;
  return (nowMs - appliedMs) / 86_400_000 > STALE_APPLICATION_DAYS;
}

// ---------- analytics ----------
// "Відмова" свідомо НЕ входить у funnelOrder нижче для конверсії/тривалості: це термінальний
// "вихід" з майже будь-якого етапу, а не наступний КРОК воронки — включення дало б хибний
// сигнал типу "конверсія Фінал→Відмова 40%", хоча Відмова могла статись і з попередніх етапів.
const FUNNEL_ORDER = ["Хочу подати", "Відправив CV", "Скринінг", "Тех.співбесіда", "Тестове завдання", "Фінал", "Оффер", "Відмова"];
const FUNNEL_PROGRESSION_ORDER = FUNNEL_ORDER.filter((s) => s !== "Відмова");

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
  // funnel — лише ПОТОЧНИЙ розподіл (знімок "де вакансія зараз"): вакансія, відхилена на
  // "Тех.співбесіді", там більше не рахується, бо статус перезаписано на "Відмова" — виглядає,
  // ніби вона туди й не доходила. funnelReached — скільки вакансій КОЛИ-НЕБУДЬ мали кожен статус
  // (з vacancy_status_history), тобто чесна воронка проходження етапів незалежно від фіналу.
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
  const stageDurations = getAvgDaysInStage().filter((d) => d.count >= 2); // count===1 — статистично незначуще, лише шум в UI
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
  if (s.staleApplications > 0)
    actions.push({
      title: `Поштовхни ${s.staleApplications} вакансій без відповіді`,
      why: `Понад ${STALE_APPLICATION_DAYS} днів тиші після подачі — напиши рекрутеру фолоу-ап або познач "Відмова", якщо вже неактуально.`,
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
      staleApplications: rows.filter((v) => isStaleApplication(v, nowMs)).length,
    };
    if (!llmAvailable()) return res.json({ offline: true, actions: heuristicFocus(summary) });
    const role = profile.domain || "фахівець";
    const out = await chatJson(
      `Ти кар'єрний ментор для кандидата (${role}) у пошуку роботи. Аналізуєш його стан і даєш 3 найважливіші конкретні дії на цей тиждень. Відповідай ЛИШЕ валідним JSON українською.`,
      `Стан пошуку (JSON): ${JSON.stringify(summary)}.\n` +
        `Дай рівно 3 пріоритетні дії з поясненням чому саме зараз. Формат строго: {"actions":[{"title":"коротка дія","why":"1 речення чому"}]}`,
      FocusActionsSchema,
      // "fast": пріоритизація 3 дій зі структурованого стану воронки — легка задача,
      // не потребує "smart"-рівня; дешевше й швидше для картки, яку юзер бачить щодня.
      { maxTokens: 500, temperature: 0.5, cache: true, tier: "fast" },
    );
    const actions: FocusAction[] = out?.actions ?? [];
    // offline:true, коли LLM не дав валідних дій (помилка провайдера/таймаут/поганий JSON навіть
    // після repair-retry в chatJson) і ми показуємо той самий героустичний фолбек, що й при
    // llmAvailable()===false вище — без цього прапорця клієнт (FocusWeekCard) не міг відрізнити
    // персональний AI-аналіз від generic-порад.
    res.json(actions.length ? { actions } : { offline: true, actions: heuristicFocus(summary) });
  }),
);

export default r;
