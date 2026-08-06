import { describe, expect, it } from "vitest";
import { limitsForPlan, planForPriceId } from "./plans.js";

describe("limitsForPlan()", () => {
  it("returns the configured monthly call ceiling and the unchanged 30/15min rate limit for free", () => {
    expect(limitsForPlan("free", 20)).toEqual({ aiCallsPerMonth: 20, aiRateLimit: 30 });
  });

  it("returns no call ceiling and a higher rate limit for pro", () => {
    expect(limitsForPlan("pro", 20)).toEqual({ aiCallsPerMonth: null, aiRateLimit: 90 });
  });

  it("returns no call ceiling and a higher rate limit for team", () => {
    expect(limitsForPlan("team", 20)).toEqual({ aiCallsPerMonth: null, aiRateLimit: 90 });
  });
});

describe("planForPriceId()", () => {
  it("resolves the configured Pro price id to 'pro'", () => {
    expect(planForPriceId("price_pro_123", "price_pro_123")).toBe("pro");
  });

  it("falls back to 'free' for an unrecognized price id", () => {
    expect(planForPriceId("price_unknown", "price_pro_123")).toBe("free");
  });

  it("falls back to 'free' when priceId is null", () => {
    expect(planForPriceId(null, "price_pro_123")).toBe("free");
  });

  it("falls back to 'free' when proPriceId is unconfigured", () => {
    expect(planForPriceId("price_pro_123", undefined)).toBe("free");
  });
});
