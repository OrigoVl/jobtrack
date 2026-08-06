import { describe, expect, it } from "vitest";
import { easeOutCubic } from "./use-count-up";

describe("easeOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("is monotonically increasing", () => {
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(easeOutCubic);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    }
  });

  it("front-loads progress (eased value is ahead of linear time before the midpoint)", () => {
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
  });
});
