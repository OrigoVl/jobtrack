import { describe, expect, it } from "vitest";
import { buildPlan, planDayIds, planGapTechs } from "./plan-builder.service.js";

// Most cases below pass the same map as both `demand` and `gapPriority` — that's fine, since
// these tests aren't about the set-cover math itself (that's shared/demand.test.ts's
// computeGapPriority() job), only about buildPlan()'s own phase-assembly logic given an already-
// ranked gap list. The dedicated "ranks by gapPriority, not demand" test below is the one that
// actually proves the two inputs are independent.
describe("planGapTechs", () => {
  it("ranks unknown technologies by gapPriority, descending", () => {
    const gaps = planGapTechs({
      profile: { skills: [] },
      gapPriority: { Docker: 3, React: 10, AWS: 5 },
    });
    expect(gaps).toEqual(["React", "AWS", "Docker"]);
  });

  it("excludes technologies already present in the profile", () => {
    const gaps = planGapTechs({
      profile: { skills: ["React"] },
      gapPriority: { Docker: 3, React: 10, AWS: 5 },
    });
    expect(gaps).toEqual(["AWS", "Docker"]);
  });

  it("caps the number of gaps at 5", () => {
    const gapPriority = { A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };
    const gaps = planGapTechs({ profile: { skills: [] }, gapPriority });
    expect(gaps).toHaveLength(5);
    expect(gaps).not.toContain("F");
  });

  it("returns an empty list when everything is already known", () => {
    expect(planGapTechs({ profile: { skills: ["React"] }, gapPriority: { React: 4 } })).toEqual([]);
  });
});

describe("buildPlan", () => {
  it("builds one phase per gap technology plus a trailing final phase, numbering days sequentially", () => {
    const demand = { React: 5, Docker: 2 };
    const phases = buildPlan({ profile: { skills: [] }, demand, gapPriority: demand });
    expect(phases.map((p) => p.id)).toEqual(["ph-react", "ph-docker", "ph-final"]);
    expect(phases.at(-1)?.id).toBe("ph-final");

    const allDays = phases.flatMap((p) => p.days);
    expect(allDays.map((d) => d.day)).toEqual(allDays.map((_, i) => i + 1));
  });

  it("ranks gap phases by gapPriority, NOT by raw demand — the two can disagree", () => {
    // Docker is mentioned in more vacancies (demand), but AWS is the higher set-cover priority
    // (gapPriority) — e.g. it's the sole missing piece across several vacancies. The phase order
    // must follow gapPriority; the phase's displayed count (`range`) must still come from demand.
    const phases = buildPlan({
      profile: { skills: [] },
      demand: { Docker: 10, AWS: 4 },
      gapPriority: { Docker: 1, AWS: 9 },
    });
    expect(phases.map((p) => p.id)).toEqual(["ph-aws", "ph-docker", "ph-final"]);
    expect(phases.find((p) => p.id === "ph-docker")?.range).toContain("10");
    expect(phases.find((p) => p.id === "ph-aws")?.range).toContain("4");
  });

  it("falls back to a refresh phase when the profile has no gaps vs. demand", () => {
    const demand = { React: 5 };
    const phases = buildPlan({ profile: { skills: ["React"] }, demand, gapPriority: {} });
    expect(phases[0]?.id).toBe("ph-refresh");
    expect(phases.at(-1)?.id).toBe("ph-final");
  });

  it("marks a tech phase as personalized when AI-generated knowledge is supplied", () => {
    const demand = { React: 3 };
    const phases = buildPlan({
      profile: { skills: [] },
      demand,
      gapPriority: demand,
      knowledgeByTech: {
        React: { tech: "React", drills: [], cards: [], focus: null, source: "ai", learn: ["Custom topic"], resources: [] },
      },
    });
    const reactPhase = phases.find((p) => p.id === "ph-react");
    expect(reactPhase?.personalized).toBe(true);
    expect(reactPhase?.days[0]?.theory).toBe("Custom topic");
  });

  it("does not retroactively mutate a previously returned plan's final phase", () => {
    const demand1 = { React: 3 };
    const first = buildPlan({ profile: { skills: [] }, demand: demand1, gapPriority: demand1 });
    const snapshot = first.find((p) => p.id === "ph-final")!.days.map((d) => d.day);
    const demand2 = { React: 3, Vue: 3, Docker: 3 };
    buildPlan({ profile: { skills: [] }, demand: demand2, gapPriority: demand2 });
    const afterSecondCall = first.find((p) => p.id === "ph-final")!.days.map((d) => d.day);
    expect(afterSecondCall).toEqual(snapshot);
  });
});

describe("planDayIds", () => {
  it("collects every day id across all phases into a single set", () => {
    const demand = { React: 2 };
    const phases = buildPlan({ profile: { skills: [] }, demand, gapPriority: demand });
    const ids = planDayIds(phases);
    const expectedCount = phases.reduce((n, p) => n + p.days.length, 0);
    expect(ids.size).toBe(expectedCount);
    expect(ids.has("final-algo")).toBe(true);
  });
});
