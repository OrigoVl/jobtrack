import { describe, expect, it } from "vitest";
import { buildRoadmap } from "./roadmap.service.js";

describe("buildRoadmap()", () => {
  it("includes every skill from the profile AND every skill in demand, deduplicated", () => {
    const result = buildRoadmap({
      skills: ["React"],
      demand: { React: 3, Vue: 1 },
      progress: {},
      drillProgress: {},
      drills: [],
    });
    const all = result.groups.flatMap((g) => g.nodes);
    expect(all.map((n) => n.tech).sort()).toEqual(["React", "Vue"]);
  });

  it("marks a profile skill known=true and status 'done' when no explicit progress is set", () => {
    const result = buildRoadmap({ skills: ["React"], demand: {}, progress: {}, drillProgress: {}, drills: [] });
    const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
    expect(node.known).toBe(true);
    expect(node.status).toBe("done");
  });

  it("marks a demand-only skill (not in the CV) known=false and status 'todo'", () => {
    const result = buildRoadmap({ skills: [], demand: { Vue: 5 }, progress: {}, drillProgress: {}, drills: [] });
    const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "Vue")!;
    expect(node.known).toBe(false);
    expect(node.status).toBe("todo");
  });

  it("explicit progress overrides the known-based default status", () => {
    const result = buildRoadmap({ skills: ["React"], demand: {}, progress: { React: "learning" }, drillProgress: {}, drills: [] });
    const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
    expect(node.status).toBe("learning");
  });

  it("sorts nodes within a group by demand descending, then alphabetically", () => {
    const result = buildRoadmap({
      skills: ["React", "Vue", "Angular"],
      demand: { React: 1, Vue: 1, Angular: 5 },
      progress: {},
      drillProgress: {},
      drills: [],
    });
    const frontendGroup = result.groups.find((g) => g.group === "Frontend")!;
    expect(frontendGroup.nodes.map((n) => n.tech)).toEqual(["Angular", "React", "Vue"]);
  });

  it("counts drillsTotal/drillsSolved scoped to the tech's own knowledge-base category", () => {
    // catFor("React") is "React" (knowledge-base.ts's own, finer-grained category — distinct
    // from TECHS' "Frontend" grouping category used for roadmap section headers).
    const result = buildRoadmap({
      skills: ["React"],
      demand: {},
      progress: {},
      drillProgress: { "react-1": "solved" },
      drills: [
        { id: "react-1", cat: "React", lvl: "easy", q: "q1", sol: "s1", exp: "e1" },
        { id: "react-2", cat: "React", lvl: "easy", q: "q2", sol: "s2", exp: "e2" },
        { id: "core-1", cat: "Core", lvl: "easy", q: "q3", sol: "s3", exp: "e3" },
      ],
    });
    const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
    expect(node.drillsTotal).toBe(2);
    expect(node.drillsSolved).toBe(1);
  });

  it("rolls up progress.done/learning/total across the whole roadmap", () => {
    const result = buildRoadmap({
      skills: ["React", "Vue"],
      demand: { Angular: 1 },
      progress: { Vue: "learning" },
      drillProgress: {},
      drills: [],
    });
    expect(result.progress).toEqual({ done: 1, learning: 1, total: 3 });
  });

  it("skips a falsy tech key from demand (defensive against a stray empty-string key)", () => {
    const result = buildRoadmap({ skills: [], demand: { "": 5, React: 1 }, progress: {}, drillProgress: {}, drills: [] });
    const all = result.groups.flatMap((g) => g.nodes);
    expect(all.map((n) => n.tech)).toEqual(["React"]);
  });
});
