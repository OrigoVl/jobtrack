// Pure plan definitions — no DB, no direct env.ts import. The one value that's actually
// configurable (Free's monthly AI-call quota) is threaded in as a parameter by the caller
// (entitlements.ts) instead of imported here, so this module has no import-order dependency on
// config/env.ts's fail-fast parse and is trivially unit-testable with plain numbers.
export type PlanId = "free" | "pro" | "team";

export interface PlanLimits {
  /** null = no call-count ceiling. Pro/Team are gated on BILLING_PRO_MONTHLY_COST_CEILING_USD
   * instead (an operator fair-use safety valve, not a marketing-facing number) — see
   * llm/client.ts's existing LLM_DAILY_COST_CAP_USD check, which still applies to every plan. */
  aiCallsPerMonth: number | null;
  /** aiLimiter's (core/rate-limit.ts) per-15-minute request ceiling for this plan. */
  aiRateLimit: number;
}

// Free's rate limit (30) matches aiLimiter's ORIGINAL hardcoded constant exactly, so a
// deployment with billing unconfigured (env.billing.isAvailable === false) — every dev machine,
// all of e2e, every self-hoster — behaves byte-identically to before this module existed.
const FREE_AI_RATE_LIMIT = 30;
const PAID_AI_RATE_LIMIT = 90;

export function limitsForPlan(plan: PlanId, freeAiCallsPerMonth: number): PlanLimits {
  if (plan === "free") return { aiCallsPerMonth: freeAiCallsPerMonth, aiRateLimit: FREE_AI_RATE_LIMIT };
  return { aiCallsPerMonth: null, aiRateLimit: PAID_AI_RATE_LIMIT };
}

/** Maps a Stripe Price id (from a webhook payload or a stored subscription row) to a plan.
 * `proPriceId` is env.billing.pricePro, passed in rather than imported for the same reason as
 * `limitsForPlan` above. An unrecognized or missing price id is "free", never a throw — a plan
 * lookup must never be the reason a webhook handler 500s. */
export function planForPriceId(priceId: string | null, proPriceId: string | undefined): PlanId {
  if (priceId && proPriceId && priceId === proPriceId) return "pro";
  return "free";
}

/** Display-only estimate for the admin panel's "estimated MRR" figure (admin.service.ts#getBillingSummary)
 * — NOT read from Stripe (fetching the Price's live amount would be another API call for a
 * number that only needs to be roughly right on a dashboard). Keep this in sync by hand if the
 * actual Stripe Price ever changes; billing itself always charges whatever
 * STRIPE_PRICE_PRO_MONTHLY specifies in Stripe, regardless of this constant. */
export const PRO_MONTHLY_PRICE_USD = 9;
