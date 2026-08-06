// Orchestration layer: checkout, the Billing Portal redirect, the client-facing billing state,
// and webhook processing. Route handlers (billing.routes.ts) stay thin and delegate here.
import { z } from "zod";
import { env } from "../../config/env.js";
import { HttpError } from "../../core/http.js";
import { contextLogger } from "../../core/logger.js";
import type { UserId } from "../../db/user-id.js";
import type { CheckoutPlan } from "../../shared/validation.js";
import {
  getSubscription,
  getSubscriptionByStripeCustomerId,
  getUserEmail,
  recordStripeEventOnce,
  upsertSubscription,
} from "./billing.repo.js";
import { getAiQuotaState, getEntitlements, type Entitlements } from "./entitlements.js";
import type { PlanId } from "./plans.js";
import * as stripeApi from "./stripe-api.js";
import { verifyStripeSignature } from "./stripe-signature.js";
import { StripeSubscriptionObjectSchema, StripeWebhookEventSchema, subscriptionUpdateFrom } from "./stripe-webhook.js";

function requireStripeSecretKey(): string {
  // Every call site here is already gated on env.billing.isAvailable (all three STRIPE_* vars
  // set together, enforced by config/env.ts's superRefine), so this cannot actually be
  // undefined in practice — the guard is for the type checker, not a real runtime path.
  if (!env.billing.stripeSecretKey) throw new HttpError(503, "Billing is not configured");
  return env.billing.stripeSecretKey;
}

// A lookup rather than a single hardcoded env read, even though CHECKOUT_PLANS (shared/
// validation.ts) has exactly one value today — the shape a Team price slots into later without
// touching startCheckout()'s own logic.
function priceIdForPlan(plan: CheckoutPlan): string | undefined {
  if (plan === "pro") return env.billing.pricePro;
  return undefined;
}

export interface BillingState {
  plan: PlanId;
  status: string;
  billingEnabled: boolean;
  aiCallsPerMonth: number | null;
  aiCallsUsed: number;
  quotaResetsAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export async function getBillingStateForUser(userId: UserId): Promise<BillingState> {
  const entitlements: Entitlements = await getEntitlements(userId);
  const quota = await getAiQuotaState(userId, entitlements);
  return {
    plan: entitlements.plan,
    status: entitlements.status,
    billingEnabled: entitlements.billingEnabled,
    aiCallsPerMonth: quota.limit,
    aiCallsUsed: quota.used,
    quotaResetsAt: quota.resetsAt,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    currentPeriodEnd: entitlements.currentPeriodEnd,
  };
}

/** Creates (or reuses) a Stripe Customer and starts a Checkout Session. `plan` comes from
 * shared/validation.ts#parseCheckoutInput — already restricted to a hardcoded whitelist before
 * this function ever sees it, so there is nothing here to re-validate against a client-supplied
 * price/amount. */
export async function startCheckout(userId: UserId, plan: CheckoutPlan): Promise<{ url: string }> {
  const secretKey = requireStripeSecretKey();
  const priceId = priceIdForPlan(plan);
  if (!priceId) throw new HttpError(503, "Billing is not configured");

  const existing = await getSubscription(userId);
  if (existing && existing.plan !== "free" && existing.status !== "canceled") {
    throw new HttpError(409, "Already subscribed", null, "ALREADY_SUBSCRIBED");
  }

  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const email = await getUserEmail(userId);
    if (!email) throw new HttpError(404, "User not found");
    const customer = await stripeApi.createStripeCustomer(secretKey, { email, userId });
    customerId = customer.id;
    // Persisted BEFORE the user ever reaches Stripe's page — so a webhook that somehow arrives
    // before checkout completes, or a user who opens the Billing Portal without ever finishing
    // checkout, can still be resolved back to this account via stripe_customer_id.
    await upsertSubscription(userId, {
      plan: existing?.plan ?? "free",
      status: existing?.status ?? "inactive",
      stripeCustomerId: customerId,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      stripePriceId: existing?.stripePriceId ?? null,
      currentPeriodEnd: existing?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    });
  }

  const session = await stripeApi.createCheckoutSession(secretKey, {
    customerId,
    priceId,
    // Derived from env.auth.baseUrl, NEVER from a client-supplied returnUrl — accepting one would
    // be an open redirect (see this module's security notes in the implementation plan).
    successUrl: `${env.auth.baseUrl}/account?checkout=success`,
    cancelUrl: `${env.auth.baseUrl}/pricing?checkout=cancelled`,
    clientReferenceId: userId,
  });
  if (!session.url) throw new HttpError(502, "Stripe did not return a checkout URL");
  return { url: session.url };
}

export async function openBillingPortal(userId: UserId): Promise<{ url: string }> {
  const secretKey = requireStripeSecretKey();
  const sub = await getSubscription(userId);
  if (!sub?.stripeCustomerId) throw new HttpError(400, "No billing account yet", null, "NO_STRIPE_CUSTOMER");
  const session = await stripeApi.createBillingPortalSession(secretKey, {
    customerId: sub.stripeCustomerId,
    returnUrl: `${env.auth.baseUrl}/account`,
  });
  return { url: session.url };
}

/** Called from auth/auth.ts's `deleteUser.beforeDelete` hook, BEFORE the `user` row (and
 * therefore, via ON DELETE CASCADE, the `subscriptions` row) is actually deleted — this is the
 * last moment stripeSubscriptionId is still readable. Cancels immediately, not at period end
 * (see stripe-api.ts#cancelStripeSubscription's own comment): the account is gone, there's no
 * "access until the period ends" left to honor, and letting Stripe keep charging a deleted
 * account would be a real billing bug, not a cosmetic one.
 *
 * Swallows its own errors deliberately: account deletion is a user-initiated, irreversible
 * action (an email-confirmed hard delete) and must never get stuck behind an unrelated Stripe
 * API hiccup — a failed cancellation here means a manual cleanup in the Stripe dashboard later,
 * which is a far better failure mode than a user who can no longer delete their own account. */
export async function cancelSubscriptionForAccountDeletion(userId: UserId): Promise<void> {
  if (!env.billing.isAvailable) return;
  try {
    const sub = await getSubscription(userId);
    if (!sub?.stripeSubscriptionId) return;
    await stripeApi.cancelStripeSubscription(requireStripeSecretKey(), sub.stripeSubscriptionId);
  } catch (err) {
    contextLogger().error(
      { err, userId },
      "Failed to cancel Stripe subscription during account deletion — may need manual cleanup in Stripe",
    );
  }
}

// Kept short on purpose: everything NOT in this set is a no-op (200, debug log) — returning 200
// for an event we don't act on is what stops Stripe retrying it forever.
const HANDLED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

const CheckoutSessionObjectSchema = z.object({ subscription: z.string().nullable().optional() });
const SubscriptionRefObjectSchema = z.object({ id: z.string() });

/** Re-fetches current truth from Stripe and writes THAT — never the webhook payload's own
 * embedded object. Stripe does not guarantee delivery order, so trusting the payload directly
 * would let an out-of-order delivery overwrite newer state with older state; always re-fetching
 * makes order irrelevant. */
async function applySubscriptionEvent(event: z.infer<typeof StripeWebhookEventSchema>): Promise<void> {
  let subscriptionId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const parsed = CheckoutSessionObjectSchema.safeParse(event.data.object);
    subscriptionId = parsed.success ? (parsed.data.subscription ?? null) : null;
  } else {
    const parsed = SubscriptionRefObjectSchema.safeParse(event.data.object);
    subscriptionId = parsed.success ? parsed.data.id : null;
  }
  if (!subscriptionId) {
    contextLogger().warn({ eventId: event.id, eventType: event.type }, "Stripe webhook event had no resolvable subscription id");
    return;
  }

  const secretKey = requireStripeSecretKey();
  const rawSub = await stripeApi.getStripeSubscription(secretKey, subscriptionId);
  const subResult = StripeSubscriptionObjectSchema.safeParse(rawSub);
  if (!subResult.success) {
    contextLogger().error({ subscriptionId, issues: subResult.error.issues }, "Stripe subscription object failed schema validation");
    return;
  }
  const update = subscriptionUpdateFrom(subResult.data, env.billing.pricePro);

  // Resolve the LOCAL user by the customer id WE persisted at checkout creation — never by an
  // email on the Stripe object, which is attacker-controlled in Checkout and mutable in the
  // Portal.
  const existing = await getSubscriptionByStripeCustomerId(update.stripeCustomerId);
  if (!existing) {
    contextLogger().warn(
      { stripeCustomerId: update.stripeCustomerId },
      "Stripe webhook for a customer with no matching local subscription row",
    );
    return;
  }
  await upsertSubscription(existing.userId, {
    plan: update.plan,
    status: update.status,
    stripeCustomerId: update.stripeCustomerId,
    stripeSubscriptionId: update.stripeSubscriptionId,
    stripePriceId: update.stripePriceId,
    currentPeriodEnd: update.currentPeriodEnd,
    cancelAtPeriodEnd: update.cancelAtPeriodEnd,
  });
}

async function applyStripeEvent(event: z.infer<typeof StripeWebhookEventSchema>): Promise<void> {
  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    contextLogger().debug({ eventType: event.type }, "Ignoring unhandled Stripe webhook event type");
    return;
  }
  if (event.type === "invoice.payment_failed") {
    // Deliberately NOT downgrading — Stripe has already moved the subscription to "past_due"
    // (a separate customer.subscription.updated event handles that) and runs its own dunning
    // retries/emails. Punishing the first failed charge would be hostile; entitlementsFor()
    // already keeps "past_due" entitled for exactly this reason.
    contextLogger().warn({ eventId: event.id }, "Stripe invoice payment failed — relying on Stripe's dunning, not downgrading");
    return;
  }
  await applySubscriptionEvent(event);
}

export interface WebhookResult {
  status: number;
}

/** The entire trust boundary for POST /api/billing/webhook. `rawBody` MUST be the exact bytes
 * Stripe sent (see app.ts's express.raw() mount) — anything re-serialized would fail signature
 * verification. Never throws; every failure mode maps to an HTTP status for the route handler to
 * return verbatim, with no response body either way (no oracle on a security-relevant check). */
export async function processStripeWebhook(rawBody: Buffer, sigHeader: string | undefined): Promise<WebhookResult> {
  if (!env.billing.isAvailable || !env.billing.stripeWebhookSecret) return { status: 503 };
  if (!verifyStripeSignature(rawBody, sigHeader, env.billing.stripeWebhookSecret)) return { status: 400 };

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { status: 400 };
  }
  const eventResult = StripeWebhookEventSchema.safeParse(parsedBody);
  if (!eventResult.success) return { status: 400 };
  const event = eventResult.data;

  // Idempotency: Stripe delivers at-least-once and retries on any non-2xx. A duplicate delivery
  // of an event we've already applied is a no-op 200, not a re-application.
  const firstSeen = await recordStripeEventOnce(event.id, event.type);
  if (!firstSeen) return { status: 200 };

  try {
    await applyStripeEvent(event);
  } catch (err) {
    contextLogger().error({ err, eventId: event.id, eventType: event.type }, "Failed to apply Stripe webhook event");
    return { status: 500 }; // non-2xx -> Stripe retries
  }
  return { status: 200 };
}
