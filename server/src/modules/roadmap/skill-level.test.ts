import { describe, expect, it } from "vitest";
import { computeSkillLevel, cardMaturity, UNCORROBORATED_CAP, MATURE_STABILITY_DAYS } from "./skill-level.js";

const NO_SIGNALS = { drillsTotal: 0, drillsSolved: 0, cardsTotal: 0, cardMaturities: [] };

describe("computeSkillLevel()", () => {
  it("is 0 for 'todo' with no corroborating content", () => {
    const result = computeSkillLevel("todo", NO_SIGNALS, null);
    expect(result.level).toBe(0);
    expect(result.levelAuto).toBe(0);
    expect(result.levelParts).toEqual({ status: 0, drills: null, recall: null });
  });

  it("caps 'done' with no corroborating content at UNCORROBORATED_CAP, not 100", () => {
    const result = computeSkillLevel("done", NO_SIGNALS, null);
    expect(result.level).toBe(UNCORROBORATED_CAP);
    expect(result.levelAuto).toBe(UNCORROBORATED_CAP);
  });

  it("reaches 100 for 'done' with all drills solved and all cards fully mature", () => {
    const result = computeSkillLevel("done", { drillsTotal: 4, drillsSolved: 4, cardsTotal: 3, cardMaturities: [1, 1, 1] }, null);
    expect(result.level).toBe(100);
    expect(result.levelParts).toEqual({ status: 100, drills: 100, recall: 100 });
  });

  it("renormalizes weights when only one practice signal is present (drills but no cards)", () => {
    // status(0.5)*100 + drills(0.2)*50, renormalized over 0.7 total weight = (50 + 10) / 0.7 = 85.71 -> 86
    const result = computeSkillLevel("done", { drillsTotal: 4, drillsSolved: 2, cardsTotal: 0, cardMaturities: [] }, null);
    expect(result.levelParts).toEqual({ status: 100, drills: 50, recall: null });
    expect(result.level).toBe(86);
  });

  it("ungraded cards drag the recall score down", () => {
    const result = computeSkillLevel("done", { drillsTotal: 0, drillsSolved: 0, cardsTotal: 4, cardMaturities: [1, 0, 0, 0] }, null);
    expect(result.levelParts.recall).toBe(25);
  });

  it("a manual override wins over the computed level, and is clamped/rounded", () => {
    const result = computeSkillLevel("todo", NO_SIGNALS, 250);
    expect(result.level).toBe(100);
    expect(result.levelManual).toBe(100);
    expect(result.levelAuto).toBe(0); // still reported, so the UI can offer "use computed value"
  });

  it("honors an explicit manual override of 0 (must use ?? not ||)", () => {
    const result = computeSkillLevel("done", NO_SIGNALS, 0);
    expect(result.level).toBe(0);
    expect(result.levelManual).toBe(0);
  });

  it("rounds a fractional manual override", () => {
    const result = computeSkillLevel("todo", NO_SIGNALS, 72.6);
    expect(result.level).toBe(73);
  });
});

describe("cardMaturity()", () => {
  it("is 0 for an unreviewed card (no SRS row)", () => {
    expect(cardMaturity(undefined)).toBe(0);
  });

  it(`saturates at 1 once stability reaches ${MATURE_STABILITY_DAYS} days`, () => {
    expect(cardMaturity({ stability: MATURE_STABILITY_DAYS, intervalDays: 1 })).toBe(1);
    expect(cardMaturity({ stability: MATURE_STABILITY_DAYS * 2, intervalDays: 1 })).toBe(1);
  });

  it("is proportional below the maturity threshold", () => {
    expect(cardMaturity({ stability: MATURE_STABILITY_DAYS / 2, intervalDays: 1 })).toBeCloseTo(0.5);
  });

  it("falls back to intervalDays when stability is null (pre-FSRS grades)", () => {
    expect(cardMaturity({ stability: null, intervalDays: MATURE_STABILITY_DAYS })).toBe(1);
    expect(cardMaturity({ stability: null, intervalDays: 0 })).toBe(0);
  });
});
