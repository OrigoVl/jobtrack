import { kbFor } from "../knowledge/knowledge-base.js";
import { slugify as slug } from "../../shared/slug.js";
import type { DynamicKnowledge } from "../knowledge/knowledge.service.js";

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

const WARMUPS = ["JS core (event loop, closures, async)", "TypeScript", "SQL", "Node/Nest", "System design", "Behavioral"];
const MAX_GAPS = 5;
const MAX_TOPICS_PER_TECH = 4;

const FINAL_PHASE: PlanPhase = {
  id: "ph-final",
  title: "Finalization — algorithms, System Design, mocks",
  range: "final days",
  note: "Common to all tracks — closing out interview patterns.",
  days: [
    {
      id: "final-algo",
      theory: "NeetCode patterns: two pointers, sliding window, hashmap, BFS/DFS, DP, Big-O",
      practice: '"Practice" → the "Algorithms" topic: solve 6-8 problems out loud',
    },
    {
      id: "final-sysdesign",
      theory: 'System Design: scaling, caching, queues, DB choice ("System Design" cards)',
      practice: "Design a URL shortener + rate limiter on paper (in the drills)",
    },
    {
      id: "final-behavioral",
      theory: "STAR stories, presenting your AI workflow, updating your CV to match the vacancy stack",
      practice: 'Do a "Mock interview" 2x; clear out weak flashcards',
    },
  ],
};

function pluralVacancy(n: number): string {
  return n === 1 ? "vacancy" : "vacancies";
}

function buildTechPhase(tech: string, count: number, index: number, dyn?: DynamicKnowledge): PlanPhase {
  const kb = kbFor(tech);
  const isAi = dyn?.source === "ai";
  const source = dyn?.learn?.length ? dyn.learn : kb.learn;
  const topics = source.length ? source.slice(0, MAX_TOPICS_PER_TECH) : [`${tech} fundamentals in practice`];
  const days: PlanDay[] = topics.map((topic, ti) => {
    const drill = kb.drills[ti % (kb.drills.length || 1)];
    const practice = drill
      ? `Problem "${drill.q}" (${drill.lvl}) — the "Practice" tab`
      : `Mini-practice on ${tech}: apply the topic to a real example`;
    return { id: `g-${slug(tech)}-${ti}`, theory: topic, practice, warmup: WARMUPS[(index + ti) % WARMUPS.length] };
  });
  const resources = dyn?.resources?.length ? dyn.resources : kb.resources;
  const note = dyn?.focus || (resources.length ? `Resources: ${resources.map((r) => r.t).join(" · ")}` : undefined);
  return {
    id: `ph-${slug(tech)}`,
    title: `${tech} — gap #${index + 1}`,
    range: `${count} ${pluralVacancy(count)} require this`,
    note,
    personalized: isAi,
    days,
  };
}

function buildRefreshPhase(strengths: [string, number][]): PlanPhase {
  const days: PlanDay[] = strengths.slice(0, MAX_TOPICS_PER_TECH).map(([tech], ti) => ({
    id: `refresh-${slug(tech)}`,
    theory: `Refresh ${tech}: common interview questions (flashcards on this topic)`,
    practice: `"Practice" — review cards/problems on ${tech}`,
    warmup: WARMUPS[ti % WARMUPS.length],
  }));
  return {
    id: "ph-refresh",
    title: "Refreshing your strengths",
    range: "your stack matches demand",
    note: "No gaps against demand — stay sharp and move on to the final phase.",
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

/** The set of valid day ids for the current plan (for validating PUT progress). */
export function planDayIds(phases: PlanPhase[]): Set<string> {
  return new Set(phases.flatMap((p) => p.days.map((d) => d.id)));
}
