import { describe, expect, it } from "vitest";
import { buildPlan, planDayIds, planGapTechs } from "./plan-builder.service.js";

describe("planGapTechs", () => {
  it("ranks unknown technologies by market demand, descending", () => {
    const gaps = planGapTechs({
      profile: { skills: [] },
      demand: { Docker: 3, React: 10, AWS: 5 },
    });
    expect(gaps).toEqual(["React", "AWS", "Docker"]);
  });

  it("excludes technologies already present in the profile", () => {
    const gaps = planGapTechs({
      profile: { skills: ["React"] },
      demand: { Docker: 3, React: 10, AWS: 5 },
    });
    expect(gaps).toEqual(["AWS", "Docker"]);
  });

  it("caps the number of gaps at 5", () => {
    const demand = { A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };
    const gaps = planGapTechs({ profile: { skills: [] }, demand });
    expect(gaps).toHaveLength(5);
    expect(gaps).not.toContain("F");
  });

  it("returns an empty list when everything is already known", () => {
    expect(planGapTechs({ profile: { skills: ["React"] }, demand: { React: 4 } })).toEqual([]);
  });
});

describe("buildPlan", () => {
  it("builds one phase per gap technology plus a trailing final phase, numbering days sequentially", () => {
    const phases = buildPlan({
      profile: { skills: [] },
      demand: { React: 5, Docker: 2 },
    });
    // React (демо >), Docker, потім завжди фінальна фаза останньою.
    expect(phases.map((p) => p.id)).toEqual(["ph-react", "ph-docker", "ph-final"]);
    expect(phases.at(-1)?.id).toBe("ph-final");

    const allDays = phases.flatMap((p) => p.days);
    expect(allDays.map((d) => d.day)).toEqual(allDays.map((_, i) => i + 1));
  });

  it("falls back to a refresh phase when the profile has no gaps vs. demand", () => {
    const phases = buildPlan({
      profile: { skills: ["React"] },
      demand: { React: 5 },
    });
    expect(phases[0].id).toBe("ph-refresh");
    expect(phases.at(-1)?.id).toBe("ph-final");
  });

  it("marks a tech phase as personalized when AI-generated knowledge is supplied", () => {
    const phases = buildPlan({
      profile: { skills: [] },
      demand: { React: 3 },
      knowledgeByTech: {
        React: { tech: "React", drills: [], cards: [], focus: null, source: "ai", learn: ["Custom topic"], resources: [] },
      },
    });
    const reactPhase = phases.find((p) => p.id === "ph-react");
    expect(reactPhase?.personalized).toBe(true);
    expect(reactPhase?.days[0].theory).toBe("Custom topic");
  });

  it("does not retroactively mutate a previously returned plan's final phase", () => {
    const first = buildPlan({ profile: { skills: [] }, demand: { React: 3 } });
    const snapshot = first.find((p) => p.id === "ph-final")!.days.map((d) => d.day);
    // Другий виклик з іншою кількістю прогалин точно дає іншу нумерацію днів фінальної фази —
    // якщо об'єкти днів спільні (не скопійовані), snapshot вище зміниться заднім числом.
    buildPlan({ profile: { skills: [] }, demand: { React: 3, Vue: 3, Docker: 3 } });
    const afterSecondCall = first.find((p) => p.id === "ph-final")!.days.map((d) => d.day);
    expect(afterSecondCall).toEqual(snapshot);
  });
});

describe("planDayIds", () => {
  it("collects every day id across all phases into a single set", () => {
    const phases = buildPlan({ profile: { skills: [] }, demand: { React: 2 } });
    const ids = planDayIds(phases);
    const expectedCount = phases.reduce((n, p) => n + p.days.length, 0);
    expect(ids.size).toBe(expectedCount);
    expect(ids.has("final-algo")).toBe(true);
  });
});
