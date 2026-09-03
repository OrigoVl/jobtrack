// Unit tests for the orchestration layer — billing.repo.js and stripe-api.js are mocked
// wholesale (matching llm/client.test.ts's approach for telemetry.repo.js), so these never touch
// a real database or the real Stripe network. verifyStripeSignature() itself is NOT mocked —
// signatures below are computed with the real HMAC, exercising the actual trust boundary.
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/http.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

const SECRET = "sk_test_key";
const WEBHOOK_SECRET = "whsec_test_secret";
const PRO_PRICE = "price_pro_test";

vi.mock("../../config/env.js", () => ({
  env: {
    logLevel: "silent",
    isProduction: false,
    billing: {
      stripeSecretKey: SECRET,
      stripeWebhookSecret: WEBHOOK_SECRET,
      pricePro: PRO_PRICE,
      freeAiCallsPerMonth: 20,
      isAvailable: true,
    },
    auth: { baseUrl: "https://app.example.test" },
  },
}));

vi.mock("./billing.repo.js", () => ({
  getSubscription: vi.fn(),
  getSubscriptionByStripeCustomerId: vi.fn(),
  getUserEmail: vi.fn(),
  upsertSubscription: vi.fn(),
  recordStripeEventOnce: vi.fn(() => true),
}));

vi.mock("./stripe-api.js", () => ({
  createStripeCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
  createBillingPortalSession: vi.fn(),
  getStripeSubscription: vi.fn(),
  cancelStripeSubscription: vi.fn(),
}));

// entitlements.ts (imported by billing.service.ts) folds a referral bonus AND an admin-granted
// bonus into the free-tier quota — both mocked here for the same reason billing.repo.js/
// stripe-api.js are: this file's real dependency is billing.repo.js's mocked getSubscription(),
// not either bonus source, and both real implementations transitively import db/client.js.
vi.mock("../referrals/referrals.service.js", () => ({
  getReferralBonusCalls: vi.fn(() => 0),
}));
vi.mock("./admin-bonus.js", () => ({
  getAdminBonusAiCalls: vi.fn(() => 0),
}));

function signedHeader(body: Buffer, secret: string, tSec: number = Math.floor(Date.now() / 1000)): string {
  const hmac = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${tSec}.`), body]))
    .digest("hex");
  return `t=${tSec},v1=${hmac}`;
}

describe("startCheckout()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Stripe customer, persists it, and returns the checkout URL for a brand-new subscriber", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue(null);
    vi.mocked(repo.getUserEmail).mockResolvedValue("user@example.test");
    vi.mocked(stripeApi.createStripeCustomer).mockResolvedValue({ id: "cus_new" });
    vi.mocked(stripeApi.createCheckoutSession).mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" });

    const { startCheckout } = await import("./billing.service.js");
    const result = await startCheckout(BOOTSTRAP_USER_ID, "pro");

    expect(result.url).toBe("https://checkout.stripe.test/cs_1");
    expect(stripeApi.createStripeCustomer).toHaveBeenCalledWith(SECRET, { email: "user@example.test", userId: BOOTSTRAP_USER_ID });
    expect(repo.upsertSubscription).toHaveBeenCalledWith(BOOTSTRAP_USER_ID, expect.objectContaining({ stripeCustomerId: "cus_new" }));
    expect(stripeApi.createCheckoutSession).toHaveBeenCalledWith(
      SECRET,
      expect.objectContaining({ customerId: "cus_new", priceId: PRO_PRICE, clientReferenceId: BOOTSTRAP_USER_ID }),
    );
  });

  it("reuses an existing Stripe customer id instead of creating a new one", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue({
      plan: "free",
      status: "canceled",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    vi.mocked(stripeApi.createCheckoutSession).mockResolvedValue({ id: "cs_2", url: "https://checkout.stripe.test/cs_2" });

    const { startCheckout } = await import("./billing.service.js");
    await startCheckout(BOOTSTRAP_USER_ID, "pro");

    expect(stripeApi.createStripeCustomer).not.toHaveBeenCalled();
    expect(stripeApi.createCheckoutSession).toHaveBeenCalledWith(SECRET, expect.objectContaining({ customerId: "cus_existing" }));
  });

  it("rejects with 409 when the user already has an active paid subscription", async () => {
    const repo = await import("./billing.repo.js");
    vi.mocked(repo.getSubscription).mockResolvedValue({
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: PRO_PRICE,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    const { startCheckout } = await import("./billing.service.js");
    await expect(startCheckout(BOOTSTRAP_USER_ID, "pro")).rejects.toMatchObject({ status: 409, code: "ALREADY_SUBSCRIBED" });
  });

  it("surfaces a 502 when Stripe returns a session with no url", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue(null);
    vi.mocked(repo.getUserEmail).mockResolvedValue("user@example.test");
    vi.mocked(stripeApi.createStripeCustomer).mockResolvedValue({ id: "cus_new" });
    vi.mocked(stripeApi.createCheckoutSession).mockResolvedValue({ id: "cs_1", url: null });

    const { startCheckout } = await import("./billing.service.js");
    await expect(startCheckout(BOOTSTRAP_USER_ID, "pro")).rejects.toBeInstanceOf(HttpError);
  });
});

describe("openBillingPortal()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects with NO_STRIPE_CUSTOMER when the user has never checked out", async () => {
    const repo = await import("./billing.repo.js");
    vi.mocked(repo.getSubscription).mockResolvedValue(null);
    const { openBillingPortal } = await import("./billing.service.js");
    await expect(openBillingPortal(BOOTSTRAP_USER_ID)).rejects.toMatchObject({ status: 400, code: "NO_STRIPE_CUSTOMER" });
  });

  it("returns the Billing Portal URL for an existing customer", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue({
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: PRO_PRICE,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    vi.mocked(stripeApi.createBillingPortalSession).mockResolvedValue({ id: "bps_1", url: "https://billing.stripe.test/bps_1" });
    const { openBillingPortal } = await import("./billing.service.js");
    const result = await openBillingPortal(BOOTSTRAP_USER_ID);
    expect(result.url).toBe("https://billing.stripe.test/bps_1");
  });
});

describe("cancelSubscriptionForAccountDeletion()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels the Stripe subscription when one exists", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue({
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: PRO_PRICE,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    const { cancelSubscriptionForAccountDeletion } = await import("./billing.service.js");
    await cancelSubscriptionForAccountDeletion(BOOTSTRAP_USER_ID);
    expect(stripeApi.cancelStripeSubscription).toHaveBeenCalledWith(SECRET, "sub_1");
  });

  it("is a no-op when the user never had a subscription", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue(null);
    const { cancelSubscriptionForAccountDeletion } = await import("./billing.service.js");
    await cancelSubscriptionForAccountDeletion(BOOTSTRAP_USER_ID);
    expect(stripeApi.cancelStripeSubscription).not.toHaveBeenCalled();
  });

  it("never throws (account deletion must not get stuck) even when the Stripe call fails", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.getSubscription).mockResolvedValue({
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: PRO_PRICE,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    vi.mocked(stripeApi.cancelStripeSubscription).mockRejectedValue(new Error("network error"));
    const { cancelSubscriptionForAccountDeletion } = await import("./billing.service.js");
    await expect(cancelSubscriptionForAccountDeletion(BOOTSTRAP_USER_ID)).resolves.toBeUndefined();
  });
});

describe("processStripeWebhook()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function subscriptionEvent(type: string, subscriptionId = "sub_1") {
    return { id: "evt_1", type, data: { object: { id: subscriptionId } } };
  }

  it("returns 400 when the signature is invalid", async () => {
    const body = Buffer.from(JSON.stringify(subscriptionEvent("customer.subscription.updated")));
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, "t=1,v1=deadbeef");
    expect(result.status).toBe(400);
  });

  it("returns 400 when the signature header is missing", async () => {
    const body = Buffer.from(JSON.stringify(subscriptionEvent("customer.subscription.updated")));
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, undefined);
    expect(result.status).toBe(400);
  });

  it("returns 200 without applying the event when it's already been seen (idempotency)", async () => {
    const repo = await import("./billing.repo.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(false);
    const body = Buffer.from(JSON.stringify(subscriptionEvent("customer.subscription.updated")));
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);
    expect(result.status).toBe(200);
    const stripeApi = await import("./stripe-api.js");
    expect(stripeApi.getStripeSubscription).not.toHaveBeenCalled();
  });

  it("re-fetches the subscription from Stripe (never trusts the payload) and upserts by customer id", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(true);
    vi.mocked(stripeApi.getStripeSubscription).mockResolvedValue({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: PRO_PRICE } }] },
    });
    vi.mocked(repo.getSubscriptionByStripeCustomerId).mockResolvedValue({
      userId: BOOTSTRAP_USER_ID,
      plan: "free",
      status: "inactive",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    const body = Buffer.from(JSON.stringify(subscriptionEvent("customer.subscription.updated")));
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);

    expect(result.status).toBe(200);
    expect(stripeApi.getStripeSubscription).toHaveBeenCalledWith(SECRET, "sub_1");
    expect(repo.upsertSubscription).toHaveBeenCalledWith(BOOTSTRAP_USER_ID, expect.objectContaining({ plan: "pro", status: "active" }));
  });

  it("does not downgrade on invoice.payment_failed — relies on Stripe's own dunning", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(true);
    const body = Buffer.from(JSON.stringify({ id: "evt_2", type: "invoice.payment_failed", data: { object: { id: "in_1" } } }));
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);
    expect(result.status).toBe(200);
    expect(stripeApi.getStripeSubscription).not.toHaveBeenCalled();
    expect(repo.upsertSubscription).not.toHaveBeenCalled();
  });

  it("returns 200 (no-op) for an event type it doesn't handle", async () => {
    const repo = await import("./billing.repo.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(true);
    const body = Buffer.from(JSON.stringify({ id: "evt_3", type: "payment_intent.succeeded", data: { object: {} } }));
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);
    expect(result.status).toBe(200);
  });

  it("does nothing and warns when no local subscription row matches the Stripe customer id", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(true);
    vi.mocked(stripeApi.getStripeSubscription).mockResolvedValue({
      id: "sub_1",
      customer: "cus_unknown",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: PRO_PRICE } }] },
    });
    vi.mocked(repo.getSubscriptionByStripeCustomerId).mockResolvedValue(null);

    const body = Buffer.from(JSON.stringify(subscriptionEvent("customer.subscription.updated")));
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);
    expect(result.status).toBe(200);
    expect(repo.upsertSubscription).not.toHaveBeenCalled();
  });

  it("returns 500 (so Stripe retries) when applying the event throws", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(true);
    vi.mocked(stripeApi.getStripeSubscription).mockRejectedValue(new Error("network error"));

    const body = Buffer.from(JSON.stringify(subscriptionEvent("customer.subscription.updated")));
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);
    expect(result.status).toBe(500);
  });

  it("resolves the subscription id from the session object for checkout.session.completed", async () => {
    const repo = await import("./billing.repo.js");
    const stripeApi = await import("./stripe-api.js");
    vi.mocked(repo.recordStripeEventOnce).mockResolvedValue(true);
    vi.mocked(stripeApi.getStripeSubscription).mockResolvedValue({
      id: "sub_from_session",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: PRO_PRICE } }] },
    });
    vi.mocked(repo.getSubscriptionByStripeCustomerId).mockResolvedValue({
      userId: BOOTSTRAP_USER_ID,
      plan: "free",
      status: "inactive",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

    const body = Buffer.from(
      JSON.stringify({ id: "evt_4", type: "checkout.session.completed", data: { object: { subscription: "sub_from_session" } } }),
    );
    const header = signedHeader(body, WEBHOOK_SECRET);
    const { processStripeWebhook } = await import("./billing.service.js");
    const result = await processStripeWebhook(body, header);
    expect(result.status).toBe(200);
    expect(stripeApi.getStripeSubscription).toHaveBeenCalledWith(SECRET, "sub_from_session");
  });
});
