import { kbFor } from "../knowledge/knowledge-base.js";
import { slugify as slug } from "../../shared/slug.js";
import type { DynamicKnowledge } from "../knowledge/knowledge.service.js";
import { getLocale } from "../../core/request-context.js";
import type { AppLocale } from "../../shared/locale.js";

// Dynamic fast-track plan: built from REAL gaps (vacancy demand − skills from CV/profile).
// Vacancies or CV change → the plan changes. Progress is stored under stable ids (per technology).

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

const MAX_GAPS = 5;
const MAX_TOPICS_PER_TECH = 4;

/** Slavic 1/2-4/5+ plural rule (11-14 are always the "many" form even though they end in a
 * digit that would otherwise read as "few") — same algorithm i18next applies to uk_one/_few/_many
 * client-side, hand-rolled here since this is plain server template text, not an i18next key. */
function ukPluralForm(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** All locale-varying copy for the generated 21-day plan, in one place so buildTechPhase/
 * buildRefreshPhase/buildPlan stay plain template logic — no scattered ternaries. */
const COPY: Record<
  AppLocale,
  {
    warmups: string[];
    finalPhase: Omit<PlanPhase, "id" | "days"> & { days: Omit<PlanDay, "id" | "day">[] };
    fallbackTopic: (tech: string) => string;
    practiceFromDrill: (q: string, lvl: string) => string;
    practiceFallback: (tech: string) => string;
    gapTitle: (tech: string, index: number) => string;
    gapRange: (count: number) => string;
    resourcesNote: (names: string) => string;
    refreshTitle: string;
    refreshRange: string;
    refreshNote: string;
    refreshTheory: (tech: string) => string;
    refreshPractice: (tech: string) => string;
  }
> = {
  en: {
    warmups: ["JS core (event loop, closures, async)", "TypeScript", "SQL", "Node/Nest", "System design", "Behavioral"],
    finalPhase: {
      title: "Finalization — algorithms, System Design, mocks",
      range: "final days",
      note: "Common to all tracks — closing out interview patterns.",
      days: [
        {
          theory: "NeetCode patterns: two pointers, sliding window, hashmap, BFS/DFS, DP, Big-O",
          practice: '"Practice" → the "Algorithms" topic: solve 6-8 problems out loud',
        },
        {
          theory: 'System Design: scaling, caching, queues, DB choice ("System Design" cards)',
          practice: "Design a URL shortener + rate limiter on paper (in the drills)",
        },
        {
          theory: "STAR stories, presenting your AI workflow, updating your CV to match the vacancy stack",
          practice: 'Do a "Mock interview" 2x; clear out weak flashcards',
        },
      ],
    },
    fallbackTopic: (tech) => `${tech} fundamentals in practice`,
    practiceFromDrill: (q, lvl) => `Problem "${q}" (${lvl}) — the "Practice" tab`,
    practiceFallback: (tech) => `Mini-practice on ${tech}: apply the topic to a real example`,
    gapTitle: (tech, index) => `${tech} — gap #${index + 1}`,
    gapRange: (count) => `${count} ${count === 1 ? "vacancy" : "vacancies"} require this`,
    resourcesNote: (names) => `Resources: ${names}`,
    refreshTitle: "Refreshing your strengths",
    refreshRange: "your stack matches demand",
    refreshNote: "No gaps against demand — stay sharp and move on to the final phase.",
    refreshTheory: (tech) => `Refresh ${tech}: common interview questions (flashcards on this topic)`,
    refreshPractice: (tech) => `"Practice" — review cards/problems on ${tech}`,
  },
  uk: {
    warmups: ["JS core (event loop, closures, async)", "TypeScript", "SQL", "Node/Nest", "Проєктування систем", "Behavioral"],
    finalPhase: {
      title: "Фіналізація — алгоритми, System Design, моки",
      range: "останні дні",
      note: "Спільне для всіх треків — закриваємо патерни співбесід.",
      days: [
        {
          theory: "Патерни NeetCode: two pointers, sliding window, hashmap, BFS/DFS, DP, Big-O",
          practice: "«Практика» → тема «Алгоритми»: розв'яжи 6-8 задач вголос",
        },
        {
          theory: "System Design: масштабування, кешування, черги, вибір БД (картки «System Design»)",
          practice: "Спроєктуй на папері URL shortener + rate limiter (у дрилах)",
        },
        {
          theory: "STAR-історії, презентація твого AI-воркфлоу, оновлення резюме під стек вакансії",
          practice: "Проведи «Мок-інтерв'ю» 2 рази; підчисти слабкі картки",
        },
      ],
    },
    fallbackTopic: (tech) => `Основи ${tech} на практиці`,
    practiceFromDrill: (q, lvl) => `Задача «${q}» (${lvl}) — вкладка «Практика»`,
    practiceFallback: (tech) => `Міні-практика з ${tech}: застосуй тему на реальному прикладі`,
    gapTitle: (tech, index) => `${tech} — прогалина №${index + 1}`,
    gapRange: (count) => `${count} ${ukPluralForm(count, "вакансія вимагає", "вакансії вимагають", "вакансій вимагають")} цього`,
    resourcesNote: (names) => `Ресурси: ${names}`,
    refreshTitle: "Освіжаємо сильні сторони",
    refreshRange: "твій стек відповідає попиту",
    refreshNote: "Немає прогалин відносно попиту — тримай форму і переходь до фінальної фази.",
    refreshTheory: (tech) => `Освіж ${tech}: типові питання співбесід (картки на цю тему)`,
    refreshPractice: (tech) => `«Практика» — повтори картки/задачі з ${tech}`,
  },
};

function buildTechPhase(tech: string, count: number, index: number, dyn?: DynamicKnowledge): PlanPhase {
  const copy = COPY[getLocale()];
  const kb = kbFor(tech);
  const isAi = dyn?.source === "ai";
  const source = dyn?.learn?.length ? dyn.learn : kb.learn;
  const topics = source.length ? source.slice(0, MAX_TOPICS_PER_TECH) : [copy.fallbackTopic(tech)];
  const days: PlanDay[] = topics.map((topic, ti) => {
    const drill = kb.drills[ti % (kb.drills.length || 1)];
    const practice = drill ? copy.practiceFromDrill(drill.q, drill.lvl) : copy.practiceFallback(tech);
    return { id: `g-${slug(tech)}-${ti}`, theory: topic, practice, warmup: copy.warmups[(index + ti) % copy.warmups.length] };
  });
  const resources = dyn?.resources?.length ? dyn.resources : kb.resources;
  const note = dyn?.focus || (resources.length ? copy.resourcesNote(resources.map((r) => r.t).join(" · ")) : undefined);
  return {
    id: `ph-${slug(tech)}`,
    title: copy.gapTitle(tech, index),
    range: copy.gapRange(count),
    note,
    personalized: isAi,
    days,
  };
}

function buildRefreshPhase(strengths: [string, number][]): PlanPhase {
  const copy = COPY[getLocale()];
  const days: PlanDay[] = strengths.slice(0, MAX_TOPICS_PER_TECH).map(([tech], ti) => ({
    id: `refresh-${slug(tech)}`,
    theory: copy.refreshTheory(tech),
    practice: copy.refreshPractice(tech),
    warmup: copy.warmups[ti % copy.warmups.length],
  }));
  return {
    id: "ph-refresh",
    title: copy.refreshTitle,
    range: copy.refreshRange,
    note: copy.refreshNote,
    days,
  };
}

interface PlanGapTechsInput {
  profile: { skills: string[] };
  demand: Record<string, number>;
}

/** Gap technologies worth generating personal content for (top by demand). */
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

/** Builds a personal plan from the profile and market demand. Returns phases with sequential day numbering. */
const FINAL_DAY_IDS = ["final-algo", "final-sysdesign", "final-behavioral"] as const;

export function buildPlan({ profile, demand, knowledgeByTech = {} }: BuildPlanInput): PlanPhase[] {
  const known = new Set(profile.skills);
  const ranked = Object.entries(demand).sort((a, b) => b[1] - a[1]);
  const gaps = ranked.filter(([tech]) => !known.has(tech)).slice(0, MAX_GAPS);
  const phases: PlanPhase[] = gaps.length
    ? gaps.map(([tech, count], i) => buildTechPhase(tech, count, i, knowledgeByTech[tech]))
    : [buildRefreshPhase(ranked.filter(([tech]) => known.has(tech)))];
  const finalPhase = COPY[getLocale()].finalPhase;
  phases.push({
    id: "ph-final",
    title: finalPhase.title,
    range: finalPhase.range,
    note: finalPhase.note,
    days: finalPhase.days.map((d, i) => ({ ...d, id: FINAL_DAY_IDS[i] ?? `final-${i}` })),
  });
  let dayNum = 0;
  for (const phase of phases) for (const day of phase.days) day.day = ++dayNum;
  return phases;
}

/** The set of valid day ids for the current plan (for validating PUT progress). */
export function planDayIds(phases: PlanPhase[]): Set<string> {
  return new Set(phases.flatMap((p) => p.days.map((d) => d.id)));
}
