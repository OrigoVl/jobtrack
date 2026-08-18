// Pure, DB-free roadmap-building logic — split out of roadmap.routes.ts so the grouping/sorting
// rules (group order, per-tech drill stats, progress summary) are unit-testable without an
// Express request/response and a live DB (same reasoning as shared/demand.ts's computeDemand()).
import { TECHS } from "../../shared/tech-dict.js";
import { kbFor, catFor, catShareCount } from "../knowledge/knowledge-base.js";
import type { Card, DrillItem } from "../study/content.js";
import type { SrsRow } from "../../db/types.js";
import { computeSkillLevel, cardMaturity } from "./skill-level.js";
import type { RoadmapStatus } from "../../shared/validation.js";
import { DEFAULT_TRACK, effectiveTrack, type Track } from "../../shared/tracks.js";
import { getProfile, getRoadmapProgress, getDrillProgress, getSrsStateByCard, getSkillLevels } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { demandMap } from "../../shared/demand.js";
import { allDrills, allCards } from "../study/content-store.js";

// group order in the roadmap (like roadmap.sh — from fundamentals to specialization). Per-track:
// only "software" needs a hand-curated order today (every existing tech-dict cat is a dev-stack
// one); other tracks fall back to a minimal order and rely on groupsInOrder() below to append
// whatever cats their techs actually resolve to, in first-seen order, rather than silently
// dropping them the way a plain whitelist-filter would.
const OTHER_GROUP = "Skills in demand";
const TRACK_GROUP_ORDER: Record<Track, string[]> = {
  software: ["Core", "Frontend", "Backend", "Database", "DevOps", "Testing", "AI", "Tools", OTHER_GROUP, "Other"],
  qa: ["Manual Testing", "Automation", "API Testing", "CI/CD", "Tools", OTHER_GROUP],
  devops: ["Core", "CI/CD", "Cloud", "Containers", "Monitoring", "Tools", OTHER_GROUP],
  data: ["Core", "Collection", "Modeling", "Visualization", "Tools", OTHER_GROUP],
  design: ["Core", "Research", "UI", "Prototyping", "Handoff", "Tools", OTHER_GROUP],
  product: ["Core", "Discovery", "Delivery", "Analytics", "Tools", OTHER_GROUP],
  security: ["Core", "AppSec", "Network", "Tools", OTHER_GROUP],
  sysadmin: ["Core", "Networking", "Systems", "Scripting", "Monitoring", "Tools", OTHER_GROUP],
  pm: ["Core", "Planning", "Execution", "Risk", "Tools", OTHER_GROUP],
  ba: ["Core", "Elicitation", "Analysis", "Documentation", "Tools", OTHER_GROUP],
};

function groupOrderFor(track: Track): string[] {
  return TRACK_GROUP_ORDER[track];
}

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
  /** Effective 0..100 skill level: the manual override when set, otherwise levelAuto. */
  level: number;
  levelAuto: number;
  levelManual: number | null;
  levelParts: { status: number; drills: number | null; recall: number | null };
  cardsTotal: number;
  cardsGraded: number;
  /** Drill/card category the level's drills/recall components are measured on, if any. */
  practiceCat: string | null;
  /** True when practiceCat is shared by more than one technology in the KB (e.g. "System Design"
   * covers Python/Go/Kubernetes/AWS/...) — the drills/recall components are then identical across
   * those techs, so the level should be read as a track-wide signal, not tech-specific proof. */
  practiceShared: boolean;
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
  cards: Card[];
  srs: Record<string, SrsRow>;
  levels: Record<string, number>;
  track?: Track;
}

export function buildRoadmap(input: BuildRoadmapInput): RoadmapResult {
  const track = input.track ?? DEFAULT_TRACK;
  const known = new Set(input.skills);
  // Universe of skills = everything in the CV/profile + everything the market demands (vacancy stack).
  const universe = new Set([...input.skills, ...Object.keys(input.demand)]);
  const byGroup: Record<string, RoadmapNode[]> = {};
  for (const tech of universe) {
    if (!tech) continue;
    const group = TECHS[tech]?.cat || OTHER_GROUP;
    const kb = kbFor(tech, track);
    const isKnown = known.has(tech);
    const status = (input.progress[tech] || (isKnown ? "done" : "todo")) as RoadmapStatus;
    const cat = catFor(tech);
    const techDrills = cat ? input.drills.filter((d) => d.cat === cat) : [];
    // Level scoring only counts CURATED drills/cards (see skill-level.ts) — otherwise generating
    // practice content on a topic you're still learning would lower your level, which is
    // non-monotone in effort. The displayed drillsTotal/drillsSolved above keep counting everything.
    const curatedDrills = techDrills.filter((d) => !d.generated);
    const techCards = cat ? input.cards.filter((c) => c.cat === cat && !c.generated) : [];
    const { level, levelAuto, levelManual, levelParts } = computeSkillLevel(
      status,
      {
        drillsTotal: curatedDrills.length,
        drillsSolved: curatedDrills.filter((d) => input.drillProgress[d.id] === "solved").length,
        cardsTotal: techCards.length,
        cardMaturities: techCards.map((c) => cardMaturity(input.srs[c.id])),
      },
      input.levels[tech] ?? null,
    );
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
      level,
      levelAuto,
      levelManual,
      levelParts,
      cardsTotal: techCards.length,
      cardsGraded: techCards.filter((c) => input.srs[c.id]).length,
      practiceCat: cat,
      practiceShared: catShareCount(cat) > 1,
    });
  }
  // Whitelisted groups first, in curated order, then any leftover group NOT in the whitelist
  // (e.g. a tech-dict cat this track's order hasn't been taught about yet) appended in
  // first-seen order — a plain `GROUP_ORDER.filter(g => byGroup[g])` would silently DROP those
  // leftovers (and their techs from the progress rollup below) instead of just under-sorting them.
  const order = groupOrderFor(track);
  const orderedGroupNames = [...order.filter((g) => byGroup[g]), ...Object.keys(byGroup).filter((g) => !order.includes(g))];
  const groups = orderedGroupNames.map((g) => ({
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

/** Assembles one user's roadmap end to end — the same read+build sequence GET /roadmap
 * (roadmap.routes.ts) used to inline, extracted so the MCP `get_roadmap` tool
 * (modules/mcp/mcp-tools.ts) can reuse the exact same assembly instead of duplicating it. */
export async function getUserRoadmap(userId: UserId): Promise<RoadmapResult> {
  const profile = await getProfile(userId);
  const track = effectiveTrack(profile);
  const demand = await demandMap(userId);
  const progress = await getRoadmapProgress(userId);
  const drillProgress = await getDrillProgress(userId);
  const [drills, cards, srs, levels] = await Promise.all([
    allDrills(userId, track),
    allCards(userId, track),
    getSrsStateByCard(userId),
    getSkillLevels(userId),
  ]);
  return buildRoadmap({ skills: profile.skills, demand, progress, drillProgress, drills, cards, srs, levels, track });
}
