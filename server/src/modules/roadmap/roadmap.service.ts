// Pure, DB-free roadmap-building logic — split out of roadmap.routes.ts so the grouping/sorting
// rules (group order, per-tech drill stats, progress summary) are unit-testable without an
// Express request/response and a live DB (same reasoning as shared/demand.ts's computeDemand()).
import { TECHS } from "../../shared/tech-dict.js";
import { kbFor, catFor } from "../knowledge/knowledge-base.js";
import type { DrillItem } from "../study/content.js";

// group order in the roadmap (like roadmap.sh — from fundamentals to specialization)
const OTHER_GROUP = "Skills in demand";
const GROUP_ORDER = ["Core", "Frontend", "Backend", "Database", "DevOps", "Testing", "AI", "Tools", OTHER_GROUP, "Other"];

export interface RoadmapNode {
  tech: string;
  group: string;
  demand: number;
  known: boolean;
  status: string;
  learn: string[];
  resources: { t: string; u: string }[];
  drillsTotal: number;
  drillsSolved: number;
}

export interface RoadmapGroup {
  group: string;
  nodes: RoadmapNode[];
}

export interface RoadmapResult {
  groups: RoadmapGroup[];
  progress: { done: number; learning: number; total: number };
}

export interface BuildRoadmapInput {
  skills: string[];
  demand: Record<string, number>;
  progress: Record<string, string>;
  drillProgress: Record<string, "solved">;
  drills: DrillItem[];
}

export function buildRoadmap(input: BuildRoadmapInput): RoadmapResult {
  const known = new Set(input.skills);
  // Universe of skills = everything in the CV/profile + everything the market demands (vacancy stack).
  const universe = new Set([...input.skills, ...Object.keys(input.demand)]);
  const byGroup: Record<string, RoadmapNode[]> = {};
  for (const tech of universe) {
    if (!tech) continue;
    const group = TECHS[tech]?.cat || OTHER_GROUP;
    const kb = kbFor(tech);
    const isKnown = known.has(tech);
    const status = input.progress[tech] || (isKnown ? "done" : "todo");
    const cat = catFor(tech);
    const techDrills = cat ? input.drills.filter((d) => d.cat === cat) : [];
    (byGroup[group] ||= []).push({
      tech,
      group,
      demand: input.demand[tech] || 0,
      known: isKnown,
      status,
      learn: kb.learn,
      resources: kb.resources,
      drillsTotal: techDrills.length,
      drillsSolved: techDrills.filter((d) => input.drillProgress[d.id] === "solved").length,
    });
  }
  const groups = GROUP_ORDER.filter((g) => byGroup[g]).map((g) => ({
    group: g,
    nodes: (byGroup[g] ?? []).sort((a, b) => b.demand - a.demand || a.tech.localeCompare(b.tech)),
  }));
  const all = groups.flatMap((g) => g.nodes);
  return {
    groups,
    progress: {
      done: all.filter((n) => n.status === "done").length,
      learning: all.filter((n) => n.status === "learning").length,
      total: all.length,
    },
  };
}
