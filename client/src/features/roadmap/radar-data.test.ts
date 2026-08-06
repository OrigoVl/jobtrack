import { describe, expect, it } from "vitest";
import { buildRadarSeries, RADAR_AXES_COMPACT } from "./radar-data";
import type { RoadmapNode } from "../../shared/types";

function makeNode(overrides: Partial<RoadmapNode> = {}): RoadmapNode {
  return {
    tech: "React",
    group: "Frontend",
    demand: 10,
    known: true,
    status: "done",
    learn: [],
    resources: [],
    drillsTotal: 0,
    drillsSolved: 0,
    level: 80,
    levelAuto: 80,
    levelManual: null,
    levelParts: { status: 100, drills: null, recall: null },
    cardsTotal: 0,
    cardsGraded: 0,
    practiceCat: "React",
    practiceShared: false,
    ...overrides,
  };
}

describe("buildRadarSeries()", () => {
  it("sorts by demand descending, then tech alphabetically", () => {
    const nodes = [makeNode({ tech: "Vue", demand: 5 }), makeNode({ tech: "React", demand: 8 }), makeNode({ tech: "Angular", demand: 8 })];
    const axes = buildRadarSeries(nodes);
    expect(axes.map((a) => a.tech)).toEqual(["Angular", "React", "Vue"]);
  });

  it("slices to the requested limit", () => {
    const nodes = Array.from({ length: 10 }, (_, i) => makeNode({ tech: `T${i}`, demand: 10 - i }));
    expect(buildRadarSeries(nodes, RADAR_AXES_COMPACT)).toHaveLength(RADAR_AXES_COMPACT);
  });

  it("indexes demandPct to the top axis (100 = most in-demand skill shown)", () => {
    const nodes = [makeNode({ tech: "React", demand: 10 }), makeNode({ tech: "Vue", demand: 5 })];
    const axes = buildRadarSeries(nodes);
    expect(axes.find((a) => a.tech === "React")!.demandPct).toBe(100);
    expect(axes.find((a) => a.tech === "Vue")!.demandPct).toBe(50);
  });

  it("excludes nodes with zero demand (would otherwise plot a degenerate 0/0 axis)", () => {
    const nodes = [makeNode({ tech: "React", demand: 10 }), makeNode({ tech: "Cobol", demand: 0 })];
    const axes = buildRadarSeries(nodes);
    expect(axes.map((a) => a.tech)).toEqual(["React"]);
  });

  it("returns a short list as-is — the caller (not this function) decides whether to render it", () => {
    const nodes = [makeNode({ tech: "React", demand: 10 }), makeNode({ tech: "Vue", demand: 5 })];
    expect(buildRadarSeries(nodes)).toHaveLength(2);
  });

  it("passes through level/levelManual for the manual-override chip", () => {
    const nodes = [makeNode({ tech: "React", demand: 10, level: 95, levelManual: 95 })];
    const axes = buildRadarSeries(nodes);
    expect(axes[0]!.level).toBe(95);
    expect(axes[0]!.levelManual).toBe(95);
  });
});
