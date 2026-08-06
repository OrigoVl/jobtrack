import { describe, expect, it } from "vitest";
import { entitlementsFor } from "./entitlements.js";
import type { SubscriptionRow } from "./billing.repo.js";

const NOW = new Date("2026-06-15T00:00:00Z").getTime();
const FUTURE = "2026-07-01T00:00:00Z";
const PAST = "2026-06-01T00:00:00Z";

function proRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    plan: "pro",
    status: "active",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    stripePriceId: "price_1",
    currentPeriodEnd: FUTURE,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe("entitlementsFor()", () => {
  it("billingEnabled: false -> unlimited free regardless of the row", () => {
    const ent = entitlementsFor(proRow(), false, 20, NOW);
    expect(ent).toMatchObject({ plan: "free", aiCallsPerMonth: null, billingEnabled: false });
  });

  it("null row (billing on, never subscribed) -> free with the configured monthly quota", () => {
    const ent = entitlementsFor(null, true, 20, NOW);
    expect(ent).toMatchObject({ plan: "free", status: "inactive", aiCallsPerMonth: 20, aiRateLimit: 30, billingEnabled: true });
  });

  it("pro + active -> unlimited", () => {
    const ent = entitlementsFor(proRow(), true, 20, NOW);
    expect(ent).toMatchObject({ plan: "pro", aiCallsPerMonth: null, aiRateLimit: 90 });
  });

  it("pro + trialing -> unlimited", () => {
    const ent = entitlementsFor(proRow({ status: "trialing" }), true, 20, NOW);
    expect(ent.plan).toBe("pro");
  });

  it("pro + past_due -> STILL entitled (Stripe is dunning, don't punish the first failed charge)", () => {
    const ent = entitlementsFor(proRow({ status: "past_due" }), true, 20, NOW);
    expect(ent.plan).toBe("pro");
    expect(ent.aiCallsPerMonth).toBeNull();
  });

  it("pro + canceled -> free", () => {
    const ent = entitlementsFor(proRow({ status: "canceled" }), true, 20, NOW);
    expect(ent.plan).toBe("free");
    expect(ent.aiCallsPerMonth).toBe(20);
  });

  it("pro + incomplete -> free (never successfully activated)", () => {
    const ent = entitlementsFor(proRow({ status: "incomplete" }), true, 20, NOW);
    expect(ent.plan).toBe("free");
  });

  it("pro + active but currentPeriodEnd already passed -> free (missed-webhook guard)", () => {
    const ent = entitlementsFor(proRow({ currentPeriodEnd: PAST }), true, 20, NOW);
    expect(ent.plan).toBe("free");
  });

  it("pro + active with no currentPeriodEnd recorded yet -> still entitled", () => {
    const ent = entitlementsFor(proRow({ currentPeriodEnd: null }), true, 20, NOW);
    expect(ent.plan).toBe("pro");
  });

  it("team + active -> unlimited, same shape as pro", () => {
    const ent = entitlementsFor(proRow({ plan: "team" }), true, 20, NOW);
    expect(ent.plan).toBe("team");
    expect(ent.aiCallsPerMonth).toBeNull();
  });

  it("an unrecognized plan value in the row is treated as free defensively", () => {
    const ent = entitlementsFor(proRow({ plan: "enterprise" }), true, 20, NOW);
    expect(ent.plan).toBe("free");
  });

  it("carries cancelAtPeriodEnd and currentPeriodEnd through for display", () => {
    const ent = entitlementsFor(proRow({ cancelAtPeriodEnd: true }), true, 20, NOW);
    expect(ent.cancelAtPeriodEnd).toBe(true);
    expect(ent.currentPeriodEnd).toBe(FUTURE);
  });
});
