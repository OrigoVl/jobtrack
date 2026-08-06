// Raw `fetch` calls to the Stripe REST API — no `stripe` SDK, matching this codebase's existing
// no-SDK stance for provider integrations (shared/email.ts's Resend call, llm/client.ts's
// OpenAI/Anthropic calls). Only 4 endpoints are needed and none of them paginate, so the SDK's
// value (typed resources, pagination, auto-retry) doesn't apply here — see billing.repo.ts's
// header comment for the fuller rationale.
//
// `Stripe-Version` is PINNED to a single constant rather than left to the account's dashboard
// default, which can change independently of this code. Pinned to a version where
// `current_period_end` still lives directly on the Subscription object (later API versions moved
// it onto each subscription item instead) — see stripe-webhook.ts#subscriptionUpdateFrom, which
// reads both locations defensively regardless.
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2024-06-20";

class StripeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

async function stripeRequest<T>(
  path: string,
  secretKey: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: URLSearchParams } = {},
): Promise<T> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: options.method ?? "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "stripe-version": STRIPE_VERSION,
      ...(options.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: options.body,
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) {
    throw new StripeApiError(res.status, data?.error?.message ?? `Stripe API error (${res.status})`);
  }
  return data as T;
}

export interface StripeCustomer {
  id: string;
}

export async function createStripeCustomer(secretKey: string, params: { email: string; userId: string }): Promise<StripeCustomer> {
  const body = new URLSearchParams();
  body.set("email", params.email);
  body.set("metadata[userId]", params.userId);
  return stripeRequest<StripeCustomer>("/customers", secretKey, { body });
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

export async function createCheckoutSession(
  secretKey: string,
  params: { customerId: string; priceId: string; successUrl: string; cancelUrl: string; clientReferenceId: string },
): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer", params.customerId);
  body.set("line_items[0][price]", params.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  // Set even though the customer is also linked — belt-and-braces resolution key for
  // checkout.session.completed (see stripe-webhook.ts), independent of the customer lookup path.
  body.set("client_reference_id", params.clientReferenceId);
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", secretKey, { body });
}

export interface StripeBillingPortalSession {
  id: string;
  url: string;
}

export async function createBillingPortalSession(
  secretKey: string,
  params: { customerId: string; returnUrl: string },
): Promise<StripeBillingPortalSession> {
  const body = new URLSearchParams();
  body.set("customer", params.customerId);
  body.set("return_url", params.returnUrl);
  return stripeRequest<StripeBillingPortalSession>("/billing_portal/sessions", secretKey, { body });
}

export interface StripeSubscriptionItem {
  price: { id: string };
  current_period_end?: number;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  items: { data: StripeSubscriptionItem[] };
}

export async function getStripeSubscription(secretKey: string, subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, secretKey, { method: "GET" });
}

/** Cancels IMMEDIATELY (not at period end) — called only from account deletion
 * (billing.service.ts#cancelSubscriptionForAccountDeletion), where the account itself is gone,
 * so there is no "keep access until the period ends" to honor. A user canceling their OWN
 * subscription while keeping their account uses the Billing Portal instead (openBillingPortal),
 * which defaults to Stripe's own at-period-end cancellation flow. */
export async function cancelStripeSubscription(secretKey: string, subscriptionId: string): Promise<void> {
  await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, secretKey, { method: "DELETE" });
}
