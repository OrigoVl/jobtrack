// Pure, DB-free axis builder for the skill radar — shared by the full Recharts version
// (skill-radar.tsx) and the compact hand-rolled SVG on the Dashboard, so the two can never
// disagree about which axes are shown or what the percentages mean.
import type { RoadmapNode, RoadmapStatus } from "../../shared/types";

export const RADAR_MIN_AXES = 3;
export const RADAR_AXES_FULL = 8;
export const RADAR_AXES_COMPACT = 6;

// i18next-typed label keys for a RoadmapStatus wire value — shared with roadmap.tsx's own status
// badge so the radar tooltip's "Status" sub-line never invents a second translation for the same
// value. Kept here (not in roadmap.tsx) to avoid a circular import: roadmap.tsx renders
// <SkillRadar>, so SkillRadar can't import back from roadmap.tsx.
export const STATUS_LABEL_KEY: Record<RoadmapStatus, "status.done" | "status.learning" | "status.todo"> = {
  done: "status.done",
  learning: "status.learning",
  todo: "status.todo",
};

export interface RadarAxis {
  tech: string;
  /** Raw recency-weighted vacancy count — for tooltips/labels, never plotted directly (see demandPct). */
  demand: number;
  /** demand indexed to the highest-demand axis on the chart: 100 = the most in-demand skill shown. */
  demandPct: number;
  level: number;
  levelManual: number | null;
  levelParts: { status: number; drills: number | null; recall: number | null };
  status: RoadmapStatus;
  drillsSolved: number;
  drillsTotal: number;
  cardsGraded: number;
  cardsTotal: number;
  practiceCat: string | null;
  practiceShared: boolean;
}

/** Builds up to `limit` radar axes from roadmap nodes, sorted by demand (desc, tech asc — same
 * order as the server's own node sort). Nodes with zero demand are dropped: a tech nobody's
 * vacancies ask for would otherwise plot as a degenerate 0/0 axis. */
export function buildRadarSeries(nodes: RoadmapNode[], limit: number = RADAR_AXES_FULL): RadarAxis[] {
  const sorted = nodes
    .filter((n) => n.demand > 0)
    .sort((a, b) => b.demand - a.demand || a.tech.localeCompare(b.tech))
    .slice(0, limit);
  const topDemand = sorted[0]?.demand ?? 0;
  return sorted.map((n) => ({
    tech: n.tech,
    demand: n.demand,
    demandPct: topDemand > 0 ? Math.round((100 * n.demand) / topDemand) : 0,
    level: n.level,
    levelManual: n.levelManual,
    levelParts: n.levelParts,
    status: n.status,
    drillsSolved: n.drillsSolved,
    drillsTotal: n.drillsTotal,
    cardsGraded: n.cardsGraded,
    cardsTotal: n.cardsTotal,
    practiceCat: n.practiceCat,
    practiceShared: n.practiceShared,
  }));
}
