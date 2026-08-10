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

  it("computes input+output cost for claude-sonnet-5 (current default ANTHROPIC_MODEL_SMART)", () => {
    // claude-sonnet-5: $3/1M input, $15/1M output.
    expect(estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000)).toBeCloseTo(18, 8);
  });

  it("computes input+output cost for gpt-4o (current default OPENAI_MODEL_SMART)", () => {
    // gpt-4o: $2.5/1M input, $10/1M output.
    expect(estimateCostUsd("gpt-4o", 1_000_000, 1_000_000)).toBeCloseTo(12.5, 8);
  });

  it("still prices gpt-5, which OPENAI_MODEL_SMART can be pointed back at — and which historical llmUsage rows reference", () => {
    // gpt-5: $1.25/1M input, $10/1M output.
    expect(estimateCostUsd("gpt-5", 1_000_000, 1_000_000)).toBeCloseTo(11.25, 8);
  });

  it("keeps pricing the retired claude-sonnet-4-5-20250929 model — historical llmUsage rows may still reference it", () => {
    expect(estimateCostUsd("claude-sonnet-4-5-20250929", 1_000_000, 1_000_000)).toBeCloseTo(18, 8);
  });

  it("returns null (not 0) for an unrecognized model — an unknown cost must not look free", () => {
    expect(estimateCostUsd("some-future-model-2027", 1000, 1000)).toBeNull();
  });

  it("returns null when model is null (e.g. every provider attempt failed)", () => {
    expect(estimateCostUsd(null, 0, 0)).toBeNull();
  });
});
