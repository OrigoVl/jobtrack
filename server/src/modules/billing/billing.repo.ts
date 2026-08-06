// Repository wrapping `subscriptions` + `stripe_events`. Unlike telemetry.repo.ts's lazy
// `import("../db/client.js")`, this module imports `db` statically (matching digest.repo.ts) —
// it's fine here because the one call site on the hot AI-request path (entitlements.ts,
// consumed by llm/client.ts) is mocked WHOLESALE in llm/client.test.ts (`vi.mock(".../entitlements.js")`),
// so the real billing.repo.ts (and its static db import) is never loaded by that test.
//
// getSubscription/upsertSubscription/getSubscriptionByStripeCustomerId/recordStripeEventOnce
// deliberately do NOT swallow their own errors, unlike telemetry.repo.ts's pattern — a thrown
// error here is meant to propagate up to llm/client.ts's quota check, which is the one place
// that decides to fail OPEN (allow the call) on any read failure. Swallowing here would instead
// make a DB outage look identical to "this user is on the Free plan", which is the wrong
// direction to fail into. countBillableAiCalls() is the one exception: it mirrors
// getUserCostUsdSince's existing contract exactly (catches, returns null = "unknown, don't
// block") since it answers the same kind of question (how much has this user used) the same way.
import { and, count, eq, gte, isNotNull, notInArray } from "drizzle-orm";
import db from "../../db/client.js";
import { llmUsage, stripeEvents, subscriptions, user } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import { contextLogger } from "../../core/logger.js";
import type { LlmUsageOutcome } from "../../telemetry/telemetry.repo.js";

export interface SubscriptionRow {
  /** Stored as free text (see db/schema/billing.ts) — not narrowed to PlanId here, so a value
   * this code doesn't recognize (a manual DB edit, a future value) is a string entitlements.ts
   * must explicitly validate rather than something the type system papers over. */
  plan: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const SUBSCRIPTION_COLUMNS = {
  plan: subscriptions.plan,
  status: subscriptions.status,
  stripeCustomerId: subscriptions.stripeCustomerId,
  stripeSubscriptionId: subscriptions.stripeSubscriptionId,
  stripePriceId: subscriptions.stripePriceId,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
} as const;

export async function getSubscription(userId: UserId): Promise<SubscriptionRow | null> {
  const [row] = await db.select(SUBSCRIPTION_COLUMNS).from(subscriptions).where(eq(subscriptions.userId, userId));
  return row ?? null;
}

export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<(SubscriptionRow & { userId: UserId }) | null> {
  const [row] = await db
    .select({ userId: subscriptions.userId, ...SUBSCRIPTION_COLUMNS })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
  return row ? { ...row, userId: row.userId as UserId } : null;
}

/** Needed only to create a Stripe Customer (checkout requires an email) — authed()/requireAdmin()
 * (core/http.ts) deliberately hand routes ONLY a userId, never the session's email, so this is a
 * plain lookup by the already-authenticated id, not a new way of resolving "who is making this
 * request". Mirrors the `user` join already used by digest.repo.ts/saved-searches.repo.ts. */
export async function getUserEmail(userId: UserId): Promise<string | null> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  return row?.email ?? null;
}

export interface SubscriptionPatch {
  plan: string;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

/** Insert-or-update by userId (the table's PK) — same onConflictDoUpdate shape as
 * digest.repo.ts#setDigestEnabled. Called from: (1) checkout creation, to persist a freshly
 * created Stripe customer id before the user ever reaches Stripe's page, and (2) the webhook
 * handler, to write back the re-fetched (never the payload-trusted) subscription state. */
export async function upsertSubscription(userId: UserId, patch: SubscriptionPatch): Promise<void> {
  const now = new Date();
  await db
    .insert(subscriptions)
    .values({ userId, ...patch, lastEventAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: subscriptions.userId, set: { ...patch, lastEventAt: now, updatedAt: now } });
}

/** Idempotency check for the webhook handler: true the FIRST time this Stripe event id is seen,
 * false on every retry — Stripe delivers at-least-once and retries any non-2xx. Atomic
 * insert-with-conflict-check, not a read-then-write, so two concurrent deliveries of the same
 * event can't both see "not seen yet". */
export async function recordStripeEventOnce(id: string, type: string): Promise<boolean> {
  const inserted = await db.insert(stripeEvents).values({ id, type }).onConflictDoNothing().returning({ id: stripeEvents.id });
  return inserted.length > 0;
}

const NON_BILLABLE_OUTCOMES: LlmUsageOutcome[] = ["budget_exceeded", "quota_exceeded"];

/** Billable AI calls for this user since `since` — backs the Free-plan monthly quota
 * (entitlements.ts#getAiQuotaState). A "billable call" excludes cache hits (free), calls already
 * blocked by a cap (would otherwise make the counter run away), and embeddings
 * (llm/embeddings.ts#recordEmbeddingUsage always passes tier: null; llm/client.ts's
 * recordLlmUsage always passes a real tier) — embeddings are a background side effect of saving
 * a vacancy, not a user-initiated AI action. Returns null (NOT 0) on a DB error and the caller
 * treats that as "allow" — same fail-open contract as telemetry.repo.ts#getUserCostUsdSince,
 * which this deliberately mirrors. */
export async function countBillableAiCalls(userId: UserId, since: Date): Promise<number | null> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(llmUsage)
      .where(
        and(
          eq(llmUsage.userId, userId),
          gte(llmUsage.createdAt, since),
          eq(llmUsage.cacheHit, false),
          isNotNull(llmUsage.tier),
          notInArray(llmUsage.outcome, NON_BILLABLE_OUTCOMES),
        ),
      );
    return Number(row?.c ?? 0);
  } catch (err) {
    contextLogger().error({ err, userId }, "Failed to count billable AI calls");
    return null;
  }
}
