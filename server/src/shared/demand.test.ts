import { describe, expect, it, vi } from "vitest";

// computeDemand()/recencyWeight() are pure and never touch the DB, but this file still has a
// top-level `import db from "../db/client.js"` for the demandMap() wrapper (untested here) — and
// that import chain resolves to a real pg Pool, which we don't want to open in a unit test. This
// mock only exists to satisfy module resolution; it's never exercised by the tests below.
vi.mock("../db/client.js", () => ({
  default: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
}));

import { computeDemand, computeGapPriority, recencyWeight, topGapTechs } from "./demand.js";

describe("recencyWeight()", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("is 1 (full weight) for a vacancy added today", () => {
    expect(recencyWeight("2026-01-01", now)).toBe(1);
  });

  it("is ~0.5 (half weight) after exactly one half-life (90 days)", () => {
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();
    expect(recencyWeight(ninetyDaysAgo, now)).toBeCloseTo(0.5, 2);
  });

  it("is ~0.25 (quarter weight) after two half-lives (180 days)", () => {
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 86_400_000).toISOString();
    expect(recencyWeight(oneEightyDaysAgo, now)).toBeCloseTo(0.25, 2);
  });

  it("decreases monotonically as the vacancy gets older", () => {
    const w30 = recencyWeight(new Date(now.getTime() - 30 * 86_400_000).toISOString(), now);
    const w200 = recencyWeight(new Date(now.getTime() - 200 * 86_400_000).toISOString(), now);
    expect(w30).toBeGreaterThan(w200);
  });

  it("treats a missing/malformed date as 'just added' (full weight) instead of penalizing old seed rows", () => {
    expect(recencyWeight("", now)).toBe(1);
    expect(recencyWeight("not-a-date", now)).toBe(1);
  });
});

describe("computeDemand()", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("counts a skill from a freshly-added vacancy at (close to) full weight", () => {
    const rows = [{ stack: ["React"], created: "2026-01-01" }];
    expect(computeDemand(rows, now)).toEqual({ React: 1 });
  });

  it(
    "weighs an old vacancy's skills less than a recent vacancy's — same skill mentioned in both " +
      "sources still nets out higher than an old-only mention",
    () => {
      const rows = [
        { stack: ["React"], created: "2026-01-01" }, // today, weight ~1
        { stack: ["COBOL"], created: "2024-01-01" }, // ~2 years ago, weight ~0
      ];
      const demand = computeDemand(rows, now);
      expect(demand.React).toBeGreaterThan(demand.COBOL ?? 0);
    },
  );

  it(
    "still lists a skill mentioned only in a very old vacancy, even if its rounded weight is 0 — " +
      "keeps it visible in the roadmap 'universe' just deprioritized, not erased",
    () => {
      const rows = [{ stack: ["COBOL"], created: "2020-01-01" }];
      const demand = computeDemand(rows, now);
      expect(Object.keys(demand)).toContain("COBOL");
    },
  );

  it("returns an empty object when there are no vacancies", () => {
    expect(computeDemand([], now)).toEqual({});
  });
});

describe("computeGapPriority()", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("gives a gap tech full credit from a vacancy where it's the ONLY thing missing", () => {
    const rows = [{ stack: ["React", "TypeScript"], created: "2026-01-01" }];
    const priority = computeGapPriority(rows, ["React"], now);
    expect(priority.TypeScript).toBeCloseTo(1, 5);
  });

  it("splits credit evenly across every still-missing tech in the same vacancy", () => {
    const rows = [{ stack: ["React", "AWS", "Docker", "GraphQL"], created: "2026-01-01" }];
    const priority = computeGapPriority(rows, [], now);
    // 4 techs, none known — each gets 1/4 of this one vacancy's unit of credit.
    expect(priority.React).toBeCloseTo(0.25, 5);
    expect(priority.AWS).toBeCloseTo(0.25, 5);
    expect(priority.Docker).toBeCloseTo(0.25, 5);
    expect(priority.GraphQL).toBeCloseTo(0.25, 5);
  });

  it("gives no credit at all for a vacancy the candidate is already fully qualified for", () => {
    const rows = [{ stack: ["React", "TypeScript"], created: "2026-01-01" }];
    const priority = computeGapPriority(rows, ["React", "TypeScript"], now);
    expect(priority).toEqual({});
  });

  it(
    "ranks the tech that's the SOLE missing piece for many vacancies above one that's merely " +
      "mentioned often but always alongside several other gaps too",
    () => {
      // Docker: raw mentions (5) beat AWS (4) — but every Docker vacancy also needs 3 other
      // unknown techs (so Docker only ever gets a 1/4 share), while AWS is the single missing
      // piece in all 4 of its own vacancies (a full share each time). A "most mentioned" ranking
      // would put Docker first; a "closes the most doors" ranking should put AWS first instead.
      const rows = [
        ...Array.from({ length: 5 }, () => ({ stack: ["Docker", "Kubernetes", "Terraform", "Helm"], created: "2026-01-01" })),
        ...Array.from({ length: 4 }, () => ({ stack: ["AWS"], created: "2026-01-01" })),
      ];
      const priority = computeGapPriority(rows, [], now);
      expect(priority.AWS ?? 0).toBeGreaterThan(priority.Docker ?? 0);
    },
  );

  it("still applies recency decay, same as computeDemand()", () => {
    const rows = [
      { stack: ["React"], created: "2026-01-01" }, // today, weight ~1
      { stack: ["Vue"], created: "2024-01-01" }, // ~2 years ago, weight ~0
    ];
    const priority = computeGapPriority(rows, [], now);
    expect(priority.React).toBeGreaterThan(priority.Vue ?? 0);
  });

  it("returns an empty object when there are no vacancies or every vacancy is fully covered", () => {
    expect(computeGapPriority([], [], now)).toEqual({});
    expect(computeGapPriority([{ stack: ["React"], created: "2026-01-01" }], ["React"], now)).toEqual({});
  });
});

describe("topGapTechs()", () => {
  it("ranks unknown technologies by the given priority map, descending", () => {
    expect(topGapTechs([], { Docker: 3, React: 10, AWS: 5 })).toEqual(["React", "AWS", "Docker"]);
  });

  it("excludes technologies already present in skills, even if they're still in the priority map", () => {
    expect(topGapTechs(["React"], { Docker: 3, React: 10, AWS: 5 })).toEqual(["AWS", "Docker"]);
  });

  it("caps the result at the given limit", () => {
    expect(topGapTechs([], { A: 6, B: 5, C: 4, D: 3 }, 2)).toEqual(["A", "B"]);
  });

  it("defaults to no cap at all when limit is omitted", () => {
    expect(topGapTechs([], { A: 6, B: 5, C: 4, D: 3 })).toEqual(["A", "B", "C", "D"]);
  });

  it("returns an empty list when everything is already known", () => {
    expect(topGapTechs(["React"], { React: 4 })).toEqual([]);
  });
});
