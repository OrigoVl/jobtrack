import express from "express";
import { getProfile, getRoadmapProgress, setRoadmapStatus, getDrillProgress } from "../../db/index.js";
import { TECHS } from "../../shared/tech-dict.js";
import { kbFor, catFor } from "../knowledge/knowledge-base.js";
import { HttpError } from "../../core/http.js";
import { ROADMAP_STATUSES, type RoadmapStatus } from "../../shared/validation.js";
import { demandMap } from "../../shared/demand.js";
import { allDrills } from "../study/content-store.js";

const r = express.Router();

// group order in the roadmap (like roadmap.sh — from fundamentals to specialization)
const OTHER_GROUP = "Skills in demand";
const GROUP_ORDER = ["Core", "Frontend", "Backend", "Database", "DevOps", "Testing", "AI", "Tools", OTHER_GROUP, "Other"];

interface RoadmapNode {
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

// ---------- roadmap (roadmap.sh style, built from REAL skills of vacancies+CV) ----------
r.get("/roadmap", (_q, res) => {
  const profile = getProfile();
  const demand = demandMap();
  const known = new Set(profile.skills);
  const progress = getRoadmapProgress();
  const drillProgress = getDrillProgress();
  const drills = allDrills();
  // Universe of skills = everything in the CV/profile + everything the market demands (vacancy stack).
  const universe = new Set([...profile.skills, ...Object.keys(demand)]);
  const byGroup: Record<string, RoadmapNode[]> = {};
  for (const tech of universe) {
    if (!tech) continue;
    const group = TECHS[tech]?.cat || OTHER_GROUP;
    const kb = kbFor(tech);
    const isKnown = known.has(tech);
    const status = progress[tech] || (isKnown ? "done" : "todo");
    const cat = catFor(tech);
    const techDrills = cat ? drills.filter((d) => d.cat === cat) : [];
    (byGroup[group] ||= []).push({
      tech,
      group,
      demand: demand[tech] || 0,
      known: isKnown,
      status,
      learn: kb.learn,
      resources: kb.resources,
      drillsTotal: techDrills.length,
      drillsSolved: techDrills.filter((d) => drillProgress[d.id] === "solved").length,
    });
  }
  const groups = GROUP_ORDER.filter((g) => byGroup[g]).map((g) => ({
    group: g,
    nodes: (byGroup[g] ?? []).sort((a, b) => b.demand - a.demand || a.tech.localeCompare(b.tech)),
  }));
  const all = groups.flatMap((g) => g.nodes);
  res.json({
    groups,
    progress: {
      done: all.filter((n) => n.status === "done").length,
      learning: all.filter((n) => n.status === "learning").length,
      total: all.length,
    },
  });
});
r.put("/roadmap/progress", (req, res) => {
  const tech = String(req.body?.tech || "")
    .trim()
    .slice(0, 80);
  const status = String(req.body?.status || "todo");
  if (!tech) throw new HttpError(400, "No skill specified");
  if (!(ROADMAP_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, `Unknown status: "${status}"`);
  res.json({ ok: true, progress: setRoadmapStatus(tech, status as RoadmapStatus) });
});

export default r;
