import { describe, expect, it } from "vitest";
import { computeDesignLevel } from "./design-level";
import type { DesignHistoryEntry } from "./types";

function entry(overrides: Partial<DesignHistoryEntry> = {}): DesignHistoryEntry {
  return {
    id: "1",
    title: "URL shortener",
    difficulty: "medium",
    score: 80,
    offline: false,
    gradedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeDesignLevel", () => {
  it("returns null when there's no history", () => {
    expect(computeDesignLevel([])).toBeNull();
  });

  it("returns null when every entry is offline (no real AI grade yet)", () => {
    expect(computeDesignLevel([entry({ offline: true }), entry({ offline: true })])).toBeNull();
  });

  it("averages a single real grade", () => {
    expect(computeDesignLevel([entry({ score: 72 })])).toEqual({ level: 72, sampleSize: 1 });
  });

  it("averages the most recent 3 real grades, rounded", () => {
    const history = [entry({ score: 90 }), entry({ score: 70 }), entry({ score: 61 })];
    expect(computeDesignLevel(history)).toEqual({ level: 74, sampleSize: 3 }); // (90+70+61)/3 = 73.67 -> 74
  });

  it("ignores entries beyond the most recent 3 (history is already newest-first)", () => {
    const history = [entry({ score: 100 }), entry({ score: 100 }), entry({ score: 100 }), entry({ score: 0 })];
    expect(computeDesignLevel(history)).toEqual({ level: 100, sampleSize: 3 });
  });

  it("excludes offline/heuristic entries from both the average and the sample count", () => {
    const history = [entry({ score: 90 }), entry({ score: 10, offline: true }), entry({ score: 70 })];
    expect(computeDesignLevel(history)).toEqual({ level: 80, sampleSize: 2 });
  });
});
