// Zod schemas for Stripe webhook payloads (CLAUDE.md: Zod for external input — a webhook body is
// the most external input this app receives) + the pure mapper from a validated Stripe
// Subscription object to our own local shape. subscriptionUpdateFrom() never reads a webhook
// event's embedded object directly in production — billing.service.ts always re-fetches current
// truth from GET /v1/subscriptions/{id} first (order-independence, see that file's comment) and
// validates THAT through StripeSubscriptionObjectSchema before calling this.
import { z } from "zod";
import { planForPriceId, type PlanId } from "./plans.js";

export const StripeSubscriptionObjectSchema = z.object({
  id: z.string(),
  customer: z.string(),
  status: z.string(),
  cancel_at_period_end: z.boolean().default(false),
  // Present directly on the subscription in the API version this app pins (stripe-api.ts) — read
  // defensively anyway (falling back to the first item's own current_period_end) in case a
  // future version migration moves it, without a schema change on that day.
  current_period_end: z.number().optional(),
  items: z.object({
    data: z
      .array(
        z.object({
          price: z.object({ id: z.string() }),
          current_period_end: z.number().optional(),
        }),
      )
      .min(1),
  }),
});
export type StripeSubscriptionObject = z.infer<typeof StripeSubscriptionObjectSchema>;

// The outer webhook envelope — deliberately permissive about `data.object`'s shape (a
// passthrough record), since its actual shape varies per event `type` and this app re-fetches
// current truth rather than trusting it anyway (see this file's header comment). Only `id` and
// `type` are load-bearing here: `id` drives idempotency (billing.repo.ts#recordStripeEventOnce),
// `type` drives dispatch (billing.service.ts#applyStripeEvent).
export const StripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

export interface SubscriptionUpdate {
  plan: PlanId;
  status: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  /** ISO instant, or null if Stripe didn't report one anywhere this function checks. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Pure — no I/O, no env import (the Pro price id is passed in, same reasoning as
 * plans.ts#planForPriceId). */
export function subscriptionUpdateFrom(sub: StripeSubscriptionObject, proPriceId: string | undefined): SubscriptionUpdate {
  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price.id ?? null;
  const periodEndSec = sub.current_period_end ?? firstItem?.current_period_end ?? null;
  return {
    plan: planForPriceId(priceId, proPriceId),
    status: sub.status,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    currentPeriodEnd: periodEndSec !== null ? new Date(periodEndSec * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}
