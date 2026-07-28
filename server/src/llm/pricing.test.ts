import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing.js";

describe("estimateCostUsd()", () => {
  it("computes input+output cost for a known model", () => {
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output.
    expect(estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 8);
  });

  it("returns 0 (not null) for a known model with 0 tokens", () => {
    expect(estimateCostUsd("gpt-4o-mini", 0, 0)).toBe(0);
  });

  it("returns null (not 0) for an unrecognized model — an unknown cost must not look free", () => {
    expect(estimateCostUsd("some-future-model-2027", 1000, 1000)).toBeNull();
  });

  it("returns null when model is null (e.g. every provider attempt failed)", () => {
    expect(estimateCostUsd(null, 0, 0)).toBeNull();
  });
});
