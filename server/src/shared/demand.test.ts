import { describe, expect, it, vi } from "vitest";

// computeDemand()/recencyWeight() are pure and never touch the DB, but this file still has a
// top-level `import db from "../db/client.js"` for the demandMap() wrapper (untested here) — and
// that import chain resolves to a real pg Pool, which we don't want to open in a unit test. This
// mock only exists to satisfy module resolution; it's never exercised by the tests below.
vi.mock("../db/client.js", () => ({
  default: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
}));

import { computeDemand, recencyWeight } from "./demand.js";

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
