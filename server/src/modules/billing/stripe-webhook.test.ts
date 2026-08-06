import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { StripeSubscriptionObjectSchema, StripeWebhookEventSchema, subscriptionUpdateFrom } from "./stripe-webhook.js";

const PRO_PRICE = "price_pro_123";

describe("StripeSubscriptionObjectSchema", () => {
  it("parses a well-formed subscription object", () => {
    const result = StripeSubscriptionObjectSchema.safeParse({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: PRO_PRICE } }] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed payload (missing required fields)", () => {
    const result = StripeSubscriptionObjectSchema.safeParse({ id: "sub_1" });
    expect(result.success).toBe(false);
  });

  it("rejects a subscription with no line items", () => {
    const result = StripeSubscriptionObjectSchema.safeParse({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      items: { data: [] },
    });
    expect(result.success).toBe(false);
  });

  it("defaults cancel_at_period_end to false when absent", () => {
    const result = StripeSubscriptionObjectSchema.parse({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      items: { data: [{ price: { id: PRO_PRICE } }] },
    });
    expect(result.cancel_at_period_end).toBe(false);
  });
});

describe("StripeWebhookEventSchema", () => {
  it("parses a well-formed webhook envelope", () => {
    const result = StripeWebhookEventSchema.safeParse({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1" } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed envelope (missing type)", () => {
    const result = StripeWebhookEventSchema.safeParse({ id: "evt_1", data: { object: {} } });
    expect(result.success).toBe(false);
  });

  it("rejects a completely unrelated JSON shape", () => {
    const result = StripeWebhookEventSchema.safeParse({ foo: "bar" });
    expect(result.success).toBe(false);
  });
});

describe("subscriptionUpdateFrom()", () => {
  function sub(overrides: Partial<z.input<typeof StripeSubscriptionObjectSchema>> = {}) {
    return StripeSubscriptionObjectSchema.parse({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: PRO_PRICE } }] },
      ...overrides,
    });
  }

  it("maps the configured Pro price id to plan 'pro'", () => {
    const update = subscriptionUpdateFrom(sub(), PRO_PRICE);
    expect(update.plan).toBe("pro");
    expect(update.stripeCustomerId).toBe("cus_1");
    expect(update.stripeSubscriptionId).toBe("sub_1");
    expect(update.stripePriceId).toBe(PRO_PRICE);
  });

  it("maps an unrecognized price id to plan 'free'", () => {
    const update = subscriptionUpdateFrom(sub({ items: { data: [{ price: { id: "price_unknown" } }] } }), PRO_PRICE);
    expect(update.plan).toBe("free");
  });

  it("converts the epoch-seconds period end to an ISO instant", () => {
    const update = subscriptionUpdateFrom(sub({ current_period_end: 1_800_000_000 }), PRO_PRICE);
    expect(update.currentPeriodEnd).toBe(new Date(1_800_000_000 * 1000).toISOString());
  });

  it("falls back to the first item's current_period_end when the subscription-level field is absent", () => {
    const update = subscriptionUpdateFrom(
      sub({ current_period_end: undefined, items: { data: [{ price: { id: PRO_PRICE }, current_period_end: 1_900_000_000 }] } }),
      PRO_PRICE,
    );
    expect(update.currentPeriodEnd).toBe(new Date(1_900_000_000 * 1000).toISOString());
  });

  it("returns null currentPeriodEnd when neither location has one", () => {
    const update = subscriptionUpdateFrom(sub({ current_period_end: undefined }), PRO_PRICE);
    expect(update.currentPeriodEnd).toBeNull();
  });

  it("passes status and cancelAtPeriodEnd through verbatim", () => {
    const update = subscriptionUpdateFrom(sub({ status: "past_due", cancel_at_period_end: true }), PRO_PRICE);
    expect(update.status).toBe("past_due");
    expect(update.cancelAtPeriodEnd).toBe(true);
  });
});
