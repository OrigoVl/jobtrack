import { describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above top-level const declarations — vi.hoisted() lets the
// mutable `rows` array be shared between the factory and the tests below without a
// "Cannot access before initialization" error.
const { rows } = vi.hoisted(() => ({ rows: [] as { stack: string; created: string }[] }));
vi.mock("../db/index.js", () => ({
  default: { prepare: () => ({ all: () => rows }) },
  j: (s: string | null | undefined) => JSON.parse(s || "[]"),
}));

import { demandMap, recencyWeight } from "./demand.js";

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

describe("demandMap()", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("counts a skill from a freshly-added vacancy at (close to) full weight", () => {
    rows.length = 0;
    rows.push({ stack: JSON.stringify(["React"]), created: "2026-01-01" });
    expect(demandMap(now)).toEqual({ React: 1 });
  });

  it(
    "weighs an old vacancy's skills less than a recent vacancy's — same skill mentioned in both " +
      "sources still nets out higher than an old-only mention",
    () => {
      rows.length = 0;
      rows.push(
        { stack: JSON.stringify(["React"]), created: "2026-01-01" }, // today, weight ~1
        { stack: JSON.stringify(["COBOL"]), created: "2024-01-01" }, // ~2 years ago, weight ~0
      );
      const demand = demandMap(now);
      expect(demand.React).toBeGreaterThan(demand.COBOL ?? 0);
    },
  );

  it(
    "still lists a skill mentioned only in a very old vacancy, even if its rounded weight is 0 — " +
      "keeps it visible in the roadmap 'universe' just deprioritized, not erased",
    () => {
      rows.length = 0;
      rows.push({ stack: JSON.stringify(["COBOL"]), created: "2020-01-01" });
      const demand = demandMap(now);
      expect(Object.keys(demand)).toContain("COBOL");
    },
  );

  it("returns an empty object when there are no vacancies", () => {
    rows.length = 0;
    expect(demandMap(now)).toEqual({});
  });
});
