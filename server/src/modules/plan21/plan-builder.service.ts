import { kbFor } from "../knowledge/knowledge-base.js";
import { slugify as slug } from "../../shared/slug.js";
import type { DynamicKnowledge } from "../knowledge/knowledge.service.js";

// Динамічний fast-track план: будується з РЕАЛЬНИХ прогалин (попит вакансій − навички з CV/профілю).
// Змінюються вакансії або CV → змінюється план. Прогрес зберігається за стабільними id (за технологією).

export interface PlanDay {
  id: string;
  theory: string;
  practice: string;
  warmup?: string;
  day?: number;
}

export interface PlanPhase {
  id: string;
  title: string;
  range: string;
  note?: string;
  personalized?: boolean;
  days: PlanDay[];
}

const WARMUPS = ["JS core (event loop, closures, async)", "TypeScript", "SQL", "Node/Nest", "System design", "Behavioral"];
const MAX_GAPS = 5;
const MAX_TOPICS_PER_TECH = 4;

const FINAL_PHASE: PlanPhase = {
  id: "ph-final",
  title: "Фіналізація — алгоритми, System Design, моки",
  range: "фінальні дні",
  note: "Спільне для всіх напрямів — закриваємо співбесідні патерни.",
  days: [
    {
      id: "final-algo",
      theory: "NeetCode-патерни: two pointers, sliding window, hashmap, BFS/DFS, DP, Big-O",
      practice: "«Тренування» → тема «Algorithms»: прорешай 6–8 задач уголос",
    },
    {
      id: "final-sysdesign",
      theory: "System Design: масштабування, кеш, черги, вибір БД (картки «System Design»)",
      practice: "Спроєктуй на папері URL shortener + rate limiter (є в дрилах)",
    },
    {
      id: "final-behavioral",
      theory: "STAR-історії, презентація AI-workflow, оновлення CV під стек вакансій",
      practice: "Пройди «Мок-інтерв'ю» 2×; закрий слабкі флеш-картки",
    },
  ],
};

function pluralVacancy(n: number): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return "вакансія";
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return "вакансії";
  return "вакансій";
}

function buildTechPhase(tech: string, count: number, index: number, dyn?: DynamicKnowledge): PlanPhase {
  const kb = kbFor(tech);
  const isAi = dyn?.source === "ai";
  const source = dyn?.learn?.length ? dyn.learn : kb.learn;
  const topics = source.length ? source.slice(0, MAX_TOPICS_PER_TECH) : [`Основи ${tech} на практиці`];
  const days: PlanDay[] = topics.map((topic, ti) => {
    const drill = kb.drills[ti % (kb.drills.length || 1)];
    const practice = drill
      ? `Задача «${drill.q}» (${drill.lvl}) — вкладка «Тренування»`
      : `Міні-практика на ${tech}: застосуй тему на реальному прикладі`;
    return { id: `g-${slug(tech)}-${ti}`, theory: topic, practice, warmup: WARMUPS[(index + ti) % WARMUPS.length] };
  });
  const resources = dyn?.resources?.length ? dyn.resources : kb.resources;
  const note = dyn?.focus || (resources.length ? `Ресурси: ${resources.map((r) => r.t).join(" · ")}` : undefined);
  return {
    id: `ph-${slug(tech)}`,
    title: `${tech} — прогалина №${index + 1}`,
    range: `${count} ${pluralVacancy(count)} потребують`,
    note,
    personalized: isAi,
    days,
  };
}

function buildRefreshPhase(strengths: [string, number][]): PlanPhase {
  const days: PlanDay[] = strengths.slice(0, MAX_TOPICS_PER_TECH).map(([tech], ti) => ({
    id: `refresh-${slug(tech)}`,
    theory: `Освіжити ${tech}: типові питання співбесіди (флеш-картки за темою)`,
    practice: `«Тренування» — повтори картки/задачі за темою ${tech}`,
    warmup: WARMUPS[ti % WARMUPS.length],
  }));
  return {
    id: "ph-refresh",
    title: "Освіження сильних сторін",
    range: "твій стек збігається з попитом",
    note: "Прогалин під попит немає — тримай форму й переходь до фіналу.",
    days,
  };
}

interface PlanGapTechsInput {
  profile: { skills: string[] };
  demand: Record<string, number>;
}

/** Технології-прогалини, під які варто згенерувати персональний контент (топ за попитом). */
export function planGapTechs({ profile, demand }: PlanGapTechsInput): string[] {
  const known = new Set(profile.skills);
  return Object.entries(demand)
    .sort((a, b) => b[1] - a[1])
    .filter(([tech]) => !known.has(tech))
    .slice(0, MAX_GAPS)
    .map(([tech]) => tech);
}

interface BuildPlanInput {
  profile: { skills: string[] };
  demand: Record<string, number>;
  knowledgeByTech?: Record<string, DynamicKnowledge>;
}

/** Будує персональний план із профілю та попиту ринку. Повертає phases з наскрізною нумерацією днів. */
export function buildPlan({ profile, demand, knowledgeByTech = {} }: BuildPlanInput): PlanPhase[] {
  const known = new Set(profile.skills);
  const ranked = Object.entries(demand).sort((a, b) => b[1] - a[1]);
  const gaps = ranked.filter(([tech]) => !known.has(tech)).slice(0, MAX_GAPS);
  const phases: PlanPhase[] = gaps.length
    ? gaps.map(([tech, count], i) => buildTechPhase(tech, count, i, knowledgeByTech[tech]))
    : [buildRefreshPhase(ranked.filter(([tech]) => known.has(tech)))];
  phases.push({ ...FINAL_PHASE, days: FINAL_PHASE.days.map((d) => ({ ...d })) });
  let dayNum = 0;
  for (const phase of phases) for (const day of phase.days) day.day = ++dayNum;
  return phases;
}

/** Множина валідних id днів для поточного плану (для валідації PUT прогресу). */
export function planDayIds(phases: PlanPhase[]): Set<string> {
  return new Set(phases.flatMap((p) => p.days.map((d) => d.id)));
}
