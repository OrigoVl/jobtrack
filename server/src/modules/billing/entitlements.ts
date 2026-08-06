// THE seam: everything in the app that asks "what is this user allowed to do" goes through
// getEntitlements()/getAiQuotaState() — never through billing.repo.ts or plans.ts directly.
//
// No caching, deliberately. A single PK lookup sits in front of a multi-second LLM call, and
// llm/client.ts already happily does a heavier aggregate (getUserCostUsdSince) in the same spot
// — an in-process cache here would buy microseconds while introducing a stale-entitlement class
// of bug (a user pays and then waits out a TTL to see it take effect; worse across replicas,
// since Redis is optional in this app per core/rate-limit.ts). Both functions stay `async` so a
// cache COULD be added later without touching a single call site — don't "optimize" this blind.
import { env } from "../../config/env.js";
import type { UserId } from "../../db/user-id.js";
import { countBillableAiCalls, getSubscription, type SubscriptionRow } from "./billing.repo.js";
import { limitsForPlan, type PlanId } from "./plans.js";

export interface Entitlements {
  plan: PlanId;
  /** Stripe's status verbatim (or "inactive") — for display only, never for gating; see
   * entitlementsFor()'s ENTITLED_STATUSES for the actual gate. */
  status: string;
  /** null = no call-count ceiling (Pro/Team). */
  aiCallsPerMonth: number | null;
  /** aiLimiter's per-15-min ceiling for this plan. */
  aiRateLimit: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  /** false when STRIPE_* is unconfigured — the whole billing layer is inert everywhere this
   * appears (no quota enforcement, no plan UI, aiLimiter back to its flat default). */
  billingEnabled: boolean;
}

// A subscription keeps granting access while Stripe is still retrying a failed charge
// ("past_due") — downgrading on the FIRST missed payment is hostile; Stripe's own dunning
// process handles recovery (see modules/billing/stripe-webhook.ts's invoice.payment_failed
// handling, which deliberately does not downgrade either). "incomplete"/"unpaid"/"canceled"/
// "incomplete_expired"/"paused" do NOT grant access.
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

function toPlanId(value: string): PlanId {
  return value === "pro" || value === "team" ? value : "free";
}

function freeEntitlements(billingEnabled: boolean, freeAiCallsPerMonth: number): Entitlements {
  const limits = limitsForPlan("free", freeAiCallsPerMonth);
  return {
    plan: "free",
    status: "inactive",
    aiCallsPerMonth: billingEnabled ? limits.aiCallsPerMonth : null,
    aiRateLimit: limits.aiRateLimit,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    billingEnabled,
  };
}

/** Pure, DB-free, env-free core — fully unit-testable with plain values. `freeAiCallsPerMonth`
 * is threaded in by the caller (getEntitlements, below) rather than read from env.ts directly,
 * same reasoning as plans.ts#limitsForPlan. */
export function entitlementsFor(
  row: SubscriptionRow | null,
  billingEnabled: boolean,
  freeAiCallsPerMonth: number,
  nowMs: number = Date.now(),
): Entitlements {
  // billingEnabled === false means STRIPE_* is unconfigured (every dev machine, all of e2e,
  // every self-hoster) — the row (if any) is ignored entirely and access is unlimited-free, so
  // the app behaves byte-identically to before this module existed.
  if (!billingEnabled) return freeEntitlements(false, freeAiCallsPerMonth);
  if (!row) return freeEntitlements(true, freeAiCallsPerMonth);

  const periodEndPassed = row.currentPeriodEnd !== null && new Date(row.currentPeriodEnd).getTime() < nowMs;
  // Missed-webhook guard: if the period has already lapsed, don't trust a stale "active" status
  // that Stripe simply never told us changed.
  const entitled = row.plan !== "free" && ENTITLED_STATUSES.has(row.status) && !periodEndPassed;
  const plan = entitled ? toPlanId(row.plan) : "free";
  const limits = limitsForPlan(plan, freeAiCallsPerMonth);

  return {
    plan,
    status: row.status,
    aiCallsPerMonth: limits.aiCallsPerMonth,
    aiRateLimit: limits.aiRateLimit,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
    billingEnabled: true,
  };
}

/** Reads this user's subscription row and resolves it to entitlements. Throws if the DB read
 * itself fails (no unconfigured-billing short-circuit needed for that case — see below) — the
 * one call site that needs fail-open behavior (llm/client.ts's quota check) wraps this in its
 * own try/catch, matching getUserCostUsdSince's existing fail-open contract for the cost cap. */
export async function getEntitlements(userId: UserId): Promise<Entitlements> {
  if (!env.billing.isAvailable) return freeEntitlements(false, env.billing.freeAiCallsPerMonth);
  const row = await getSubscription(userId);
  return entitlementsFor(row, true, env.billing.freeAiCallsPerMonth);
}

export interface AiQuotaState {
  allowed: boolean;
  used: number;
  /** null = no ceiling (Pro/Team). */
  limit: number | null;
  /** ISO instant the count resets — start of next UTC calendar month. null when `limit` is null. */
  resetsAt: string | null;
}

function startOfUtcMonth(nowMs: number): Date {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfNextUtcMonth(nowMs: number): Date {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** Composes plan (long-lived) with live usage (zero-second shelf life) — kept as two functions
 * rather than one field on Entitlements so a Pro/Team caller (the vast majority of billable
 * traffic once billing ships) never pays for the llm_usage aggregate: `aiCallsPerMonth === null`
 * short-circuits before touching the database at all. */
export async function getAiQuotaState(userId: UserId, entitlements?: Entitlements, nowMs: number = Date.now()): Promise<AiQuotaState> {
  const ent = entitlements ?? (await getEntitlements(userId));
  if (ent.aiCallsPerMonth === null) return { allowed: true, used: 0, limit: null, resetsAt: null };

  const resetsAt = startOfNextUtcMonth(nowMs).toISOString();
  const used = await countBillableAiCalls(userId, startOfUtcMonth(nowMs));
  // null = the count itself failed (see billing.repo.ts#countBillableAiCalls) — fail open rather
  // than block on an unrelated telemetry-read error.
  if (used === null) return { allowed: true, used: 0, limit: ent.aiCallsPerMonth, resetsAt };
  return { allowed: used < ent.aiCallsPerMonth, used, limit: ent.aiCallsPerMonth, resetsAt };
}
