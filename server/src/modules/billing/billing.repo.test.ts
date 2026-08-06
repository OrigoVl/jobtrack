// Integration test against a REAL (in-process, PGlite) Postgres — same pattern as
// digest.repo.test.ts/telemetry.repo.test.ts. db/client.js is mocked via vi.doMock BEFORE the
// dynamic import below, so billing.repo.ts's static `import db from "../../db/client.js"` picks
// up the test instance the first time any of its functions actually run.
import { beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./billing.repo.js");
let insertLlmUsage: typeof import("../../telemetry/telemetry.repo.js").insertLlmUsage;

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, BOOTSTRAP_USER_ID);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./billing.repo.js");
  const telemetryRepo = await import("../../telemetry/telemetry.repo.js");
  insertLlmUsage = telemetryRepo.insertLlmUsage;
});

describe("getSubscription() / upsertSubscription() (PGlite)", () => {
  it("getSubscription() returns null for a user with no row yet", async () => {
    expect(await repo.getSubscription("user-no-sub" as UserId)).toBeNull();
  });

  it("upsertSubscription() creates the row on first call and updates it on the next", async () => {
    const userId = "user-upsert" as UserId;
    await insertTestUser(testDb, userId);
    await repo.upsertSubscription(userId, {
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_upsert",
      stripeSubscriptionId: "sub_upsert",
      stripePriceId: "price_upsert",
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    expect(await repo.getSubscription(userId)).toMatchObject({ plan: "pro", status: "active" });

    await repo.upsertSubscription(userId, {
      plan: "free",
      status: "canceled",
      stripeCustomerId: "cus_upsert",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: "2026-07-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    expect(await repo.getSubscription(userId)).toMatchObject({ plan: "free", status: "canceled", stripeSubscriptionId: null });
  });

  it("multi-tenant scoping holds at the SQL level: one user's row is invisible under another's id", async () => {
    const userA = "user-tenant-a" as UserId;
    const userB = "user-tenant-b" as UserId;
    await insertTestUser(testDb, userA);
    await insertTestUser(testDb, userB);
    await repo.upsertSubscription(userA, {
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_tenant_a",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(await repo.getSubscription(userB)).toBeNull();
  });

  it("getSubscriptionByStripeCustomerId() resolves the right user", async () => {
    const userId = "user-by-customer" as UserId;
    await insertTestUser(testDb, userId);
    await repo.upsertSubscription(userId, {
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_lookup_target",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    const found = await repo.getSubscriptionByStripeCustomerId("cus_lookup_target");
    expect(found?.userId).toBe(userId);
    expect(await repo.getSubscriptionByStripeCustomerId("cus_does_not_exist")).toBeNull();
  });

  it("the unique index on stripe_customer_id actually rejects a duplicate at the SQL level", async () => {
    const userA = "user-dup-customer-a" as UserId;
    const userB = "user-dup-customer-b" as UserId;
    await insertTestUser(testDb, userA);
    await insertTestUser(testDb, userB);
    await repo.upsertSubscription(userA, {
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_duplicate",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    await expect(
      repo.upsertSubscription(userB, {
        plan: "pro",
        status: "active",
        stripeCustomerId: "cus_duplicate",
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      }),
    ).rejects.toThrow();
  });

  it("FK cascade removes the subscription row when the user row is deleted", async () => {
    const userId = "user-cascade" as UserId;
    await insertTestUser(testDb, userId);
    await repo.upsertSubscription(userId, {
      plan: "pro",
      status: "active",
      stripeCustomerId: "cus_cascade",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    const schema = await import("../../db/schema/index.js");
    await testDb.delete(schema.user).where(eq(schema.user.id, userId));
    expect(await repo.getSubscription(userId)).toBeNull();
  });
});

describe("recordStripeEventOnce() (PGlite)", () => {
  it("returns true the first time an event id is seen, false on every retry", async () => {
    expect(await repo.recordStripeEventOnce("evt_dedupe_1", "customer.subscription.updated")).toBe(true);
    expect(await repo.recordStripeEventOnce("evt_dedupe_1", "customer.subscription.updated")).toBe(false);
    expect(await repo.recordStripeEventOnce("evt_dedupe_1", "customer.subscription.updated")).toBe(false);
  });

  it("treats distinct event ids independently", async () => {
    expect(await repo.recordStripeEventOnce("evt_dedupe_2", "checkout.session.completed")).toBe(true);
    expect(await repo.recordStripeEventOnce("evt_dedupe_3", "checkout.session.completed")).toBe(true);
  });
});

describe("countBillableAiCalls() (PGlite)", () => {
  it("counts a plain successful, non-cached call with a real tier", async () => {
    const userId = "user-count-a" as UserId;
    await insertTestUser(testDb, userId);
    await insertLlmUsage({
      userId,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "fast",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cacheHit: false,
      latencyMs: 10,
      outcome: "success",
    });
    expect(await repo.countBillableAiCalls(userId, new Date(0))).toBe(1);
  });

  it("excludes cache hits", async () => {
    const userId = "user-count-cache" as UserId;
    await insertTestUser(testDb, userId);
    await insertLlmUsage({
      userId,
      feature: "cv-review",
      provider: null,
      model: null,
      tier: "fast",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheHit: true,
      latencyMs: 0,
      outcome: "cache_hit",
    });
    expect(await repo.countBillableAiCalls(userId, new Date(0))).toBe(0);
  });

  it("excludes calls already blocked (budget_exceeded / quota_exceeded), so the counter can't run away", async () => {
    const userId = "user-count-blocked" as UserId;
    await insertTestUser(testDb, userId);
    await insertLlmUsage({
      userId,
      feature: "cv-review",
      provider: null,
      model: null,
      tier: "fast",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheHit: false,
      latencyMs: 0,
      outcome: "budget_exceeded",
    });
    await insertLlmUsage({
      userId,
      feature: "cv-review",
      provider: null,
      model: null,
      tier: "fast",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheHit: false,
      latencyMs: 0,
      outcome: "quota_exceeded",
    });
    expect(await repo.countBillableAiCalls(userId, new Date(0))).toBe(0);
  });

  it("excludes embeddings (tier: null), which are a background side effect, not a user-initiated AI action", async () => {
    const userId = "user-count-embedding" as UserId;
    await insertTestUser(testDb, userId);
    await insertLlmUsage({
      userId,
      feature: "vacancy-embedding",
      provider: "openai",
      model: "text-embedding-3-small",
      tier: null,
      inputTokens: 200,
      outputTokens: 0,
      totalTokens: 200,
      cacheHit: false,
      latencyMs: 5,
      outcome: "success",
    });
    expect(await repo.countBillableAiCalls(userId, new Date(0))).toBe(0);
  });

  it("respects the `since` boundary", async () => {
    const userId = "user-count-cutoff" as UserId;
    await insertTestUser(testDb, userId);
    await insertLlmUsage({
      userId,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "fast",
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      cacheHit: false,
      latencyMs: 1,
      outcome: "success",
    });
    const schema = await import("../../db/schema/index.js");
    await testDb
      .update(schema.llmUsage)
      .set({ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) })
      .where(eq(schema.llmUsage.userId, userId));

    const sinceYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(await repo.countBillableAiCalls(userId, sinceYesterday)).toBe(0);
    expect(await repo.countBillableAiCalls(userId, new Date(0))).toBe(1);
  });
});
