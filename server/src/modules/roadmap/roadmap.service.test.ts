import { describe, expect, it } from "vitest";
import { buildRoadmap } from "./roadmap.service.js";

// Every buildRoadmap() call needs cards/srs/levels now (level-scoring inputs) — default to empty
// so pre-existing behavior around status/known/drills/grouping stays covered without every test
// having to opt into the new signals.
const EMPTY_LEVEL_INPUTS = { cards: [], srs: {}, levels: {} };

describe("buildRoadmap()", () => {
  it("includes every skill from the profile AND every skill in demand, deduplicated", () => {
    const result = buildRoadmap({
      skills: ["React"],
      demand: { React: 3, Vue: 1 },
      progress: {},
      drillProgress: {},
      drills: [],
      ...EMPTY_LEVEL_INPUTS,
    });
    const all = result.groups.flatMap((g) => g.nodes);
    expect(all.map((n) => n.tech).sort()).toEqual(["React", "Vue"]);
  });

  it("marks a profile skill known=true and status 'done' when no explicit progress is set", () => {
    const result = buildRoadmap({ skills: ["React"], demand: {}, progress: {}, drillProgress: {}, drills: [], ...EMPTY_LEVEL_INPUTS });
    const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
    expect(node.known).toBe(true);
    expect(node.status).toBe("done");
  });

  it("marks a demand-only skill (not in the CV) known=false and status 'todo'", () => {
    const result = buildRoadmap({ skills: [], demand: { Vue: 5 }, progress: {}, drillProgress: {}, drills: [], ...EMPTY_LEVEL_INPUTS });
    const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "Vue")!;
    expect(node.known).toBe(false);
    expect(node.status).toBe("todo");
  });

  it("explicit progress overrides the known-based default status", () => {
    const result = buildRoadmap({
      skills: ["React"],
      demand: {},
      progress: { React: "learning" },
      drillProgress: {},
      drills: [],
      ...EMPTY_LEVEL_INPUTS,
    });
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
      ...EMPTY_LEVEL_INPUTS,
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
      ...EMPTY_LEVEL_INPUTS,
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
      ...EMPTY_LEVEL_INPUTS,
    });
    expect(result.progress).toEqual({ done: 1, learning: 1, total: 3 });
  });

  it("skips a falsy tech key from demand (defensive against a stray empty-string key)", () => {
    const result = buildRoadmap({
      skills: [],
      demand: { "": 5, React: 1 },
      progress: {},
      drillProgress: {},
      drills: [],
      ...EMPTY_LEVEL_INPUTS,
    });
    const all = result.groups.flatMap((g) => g.nodes);
    expect(all.map((n) => n.tech)).toEqual(["React"]);
  });

  describe("skill level", () => {
    it("caps a self-declared 'done' skill's level at 80 when no drills/cards corroborate it", () => {
      const result = buildRoadmap({ skills: ["React"], demand: {}, progress: {}, drillProgress: {}, drills: [], ...EMPTY_LEVEL_INPUTS });
      const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
      expect(node.level).toBe(80);
      expect(node.levelAuto).toBe(80);
      expect(node.levelManual).toBeNull();
      expect(node.levelParts).toEqual({ status: 100, drills: null, recall: null });
    });

    it("factors solved drills and graded flashcard recall into the level", () => {
      const result = buildRoadmap({
        skills: ["React"],
        demand: {},
        progress: {},
        drillProgress: { "react-1": "solved" },
        drills: [
          { id: "react-1", cat: "React", lvl: "easy", q: "q", sol: "s", exp: "e" },
          { id: "react-2", cat: "React", lvl: "easy", q: "q", sol: "s", exp: "e" },
        ],
        cards: [{ id: "card-1", cat: "React", q: "q", a: "a" }],
        srs: {
          "card-1": {
            cardId: "card-1",
            intervalDays: 21,
            due: "2026-01-01",
            reps: 1,
            difficulty: 5,
            stability: 21,
            lastReview: "2026-01-01",
          },
        },
        levels: {},
      });
      const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
      // status 100*0.5 + drills 50*0.2 + recall 100*0.3 = 50 + 10 + 30 = 90
      expect(node.levelParts).toEqual({ status: 100, drills: 50, recall: 100 });
      expect(node.level).toBe(90);
      expect(node.cardsTotal).toBe(1);
      expect(node.cardsGraded).toBe(1);
    });

    it("excludes generated drills/cards from the level (only curated content corroborates it)", () => {
      const result = buildRoadmap({
        skills: ["React"],
        demand: {},
        progress: {},
        drillProgress: { "react-gen": "solved" },
        drills: [{ id: "react-gen", cat: "React", lvl: "easy", q: "q", sol: "s", exp: "e", generated: true }],
        ...EMPTY_LEVEL_INPUTS,
      });
      const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
      // Displayed counters still include the generated drill...
      expect(node.drillsTotal).toBe(1);
      expect(node.drillsSolved).toBe(1);
      // ...but the level is unaffected — no curated content, so it's capped as uncorroborated.
      expect(node.levelParts.drills).toBeNull();
      expect(node.level).toBe(80);
    });

    it("a manual override wins over the computed level but levelAuto is still reported", () => {
      const result = buildRoadmap({
        skills: ["React"],
        demand: {},
        progress: {},
        drillProgress: {},
        drills: [],
        cards: [],
        srs: {},
        levels: { React: 95 },
      });
      const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "React")!;
      expect(node.level).toBe(95);
      expect(node.levelManual).toBe(95);
      expect(node.levelAuto).toBe(80);
    });

    it("flags practiceShared when the category is shared by more than one technology (e.g. System Design)", () => {
      const result = buildRoadmap({
        skills: ["Python", "Go"],
        demand: {},
        progress: {},
        drillProgress: {},
        drills: [],
        ...EMPTY_LEVEL_INPUTS,
      });
      const all = result.groups.flatMap((g) => g.nodes);
      expect(all.find((n) => n.tech === "Python")!.practiceShared).toBe(true);
      expect(all.find((n) => n.tech === "Go")!.practiceShared).toBe(true);
      expect(all.find((n) => n.tech === "Python")!.practiceCat).toBe("System Design");
    });

    it("does not flag practiceShared for a category used by only one technology (e.g. Docker)", () => {
      const result = buildRoadmap({ skills: ["Docker"], demand: {}, progress: {}, drillProgress: {}, drills: [], ...EMPTY_LEVEL_INPUTS });
      const node = result.groups.flatMap((g) => g.nodes).find((n) => n.tech === "Docker")!;
      expect(node.practiceShared).toBe(false);
    });
  });

  describe("track-aware grouping", () => {
    it("orders groups per the software track's curated order by default (track omitted)", () => {
      const result = buildRoadmap({
        skills: ["Docker", "React", "Node.js"],
        demand: {},
        progress: {},
        drillProgress: {},
        drills: [],
        ...EMPTY_LEVEL_INPUTS,
      });
      expect(result.groups.map((g) => g.group)).toEqual(["Frontend", "Backend", "DevOps"]);
    });

    // Regression for the former `GROUP_ORDER.filter(g => byGroup[g])` bug: filtering a whitelist
    // silently DROPS any group not in it. "qa"'s curated order doesn't list "Frontend" — a tech
    // resolving to that cat (React, via the shared tech-dict) must still show up as a leftover
    // group, not vanish from the roadmap and its progress rollup.
    it("retains a group not in the current track's curated order instead of dropping it", () => {
      const result = buildRoadmap({
        skills: ["React"],
        demand: {},
        progress: {},
        drillProgress: {},
        drills: [],
        ...EMPTY_LEVEL_INPUTS,
        track: "qa",
      });
      const all = result.groups.flatMap((g) => g.nodes);
      expect(all.map((n) => n.tech)).toEqual(["React"]);
      expect(result.groups.some((g) => g.group === "Frontend")).toBe(true);
      expect(result.progress.total).toBe(1);
    });
  });
});
