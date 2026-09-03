// Integration test against a REAL (in-process, PGlite) Postgres — same pattern as
// companies.repo.test.ts: proves the aggregation queries (GROUP BY, sum, date bucketing) return
// correct numbers, not a mocked approximation of them, and that per-page activity counts never
// leak another user's rows into a user's count.
import { beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let getOverview: typeof import("./admin.service.js").getOverview;
let listUsersWithActivity: typeof import("./admin.service.js").listUsersWithActivity;
let getLlmUsageSummary: typeof import("./admin.service.js").getLlmUsageSummary;
let getProductEventsSummary: typeof import("./admin.service.js").getProductEventsSummary;
let getBillingSummary: typeof import("./admin.service.js").getBillingSummary;
let grantTemporaryPlan: typeof import("./admin.service.js").grantTemporaryPlan;
let grantBonusAiCalls: typeof import("./admin.service.js").grantBonusAiCalls;
let getSubscription: typeof import("../billing/billing.repo.js").getSubscription;
let getAdminBonusAiCalls: typeof import("../billing/admin-bonus.js").getAdminBonusAiCalls;
let llmUsage: typeof import("../../db/schema/index.js").llmUsage;
let productEvents: typeof import("../../db/schema/index.js").productEvents;
let vacancies: typeof import("../../db/schema/index.js").vacancies;
let subscriptions: typeof import("../../db/schema/index.js").subscriptions;

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  const service = await import("./admin.service.js");
  getOverview = service.getOverview;
  listUsersWithActivity = service.listUsersWithActivity;
  getLlmUsageSummary = service.getLlmUsageSummary;
  getProductEventsSummary = service.getProductEventsSummary;
  getBillingSummary = service.getBillingSummary;
  grantTemporaryPlan = service.grantTemporaryPlan;
  grantBonusAiCalls = service.grantBonusAiCalls;
  const billingRepo = await import("../billing/billing.repo.js");
  getSubscription = billingRepo.getSubscription;
  const adminBonus = await import("../billing/admin-bonus.js");
  getAdminBonusAiCalls = adminBonus.getAdminBonusAiCalls;
  const schema = await import("../../db/schema/index.js");
  llmUsage = schema.llmUsage;
  productEvents = schema.productEvents;
  vacancies = schema.vacancies;
  subscriptions = schema.subscriptions;

  await testDb.insert(vacancies).values([
    { userId: USER_A, company: "Acme", position: "Engineer" },
    { userId: USER_A, company: "Beta", position: "Engineer" },
    { userId: USER_B, company: "Gamma", position: "Designer" },
  ]);
  // USER_A is on Pro (an explicit row); USER_B has no row at all — the missing-row-means-free
  // convention (entitlements.ts) that listUsersWithActivity/getBillingSummary must reproduce.
  await testDb.insert(subscriptions).values([{ userId: USER_A, plan: "pro", status: "active", stripeCustomerId: "cus_admin_test" }]);
  await testDb.insert(llmUsage).values([
    {
      userId: USER_A,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "smart",
      inputTokens: 1000,
      outputTokens: 200,
      totalTokens: 1200,
      costUsd: 0.5,
      cacheHit: false,
      outcome: "success",
    },
    {
      userId: USER_A,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "smart",
      inputTokens: 500,
      outputTokens: 100,
      totalTokens: 600,
      costUsd: 0.25,
      cacheHit: false,
      outcome: "success",
    },
    {
      userId: USER_A,
      feature: "cv-review",
      provider: null,
      model: null,
      tier: "smart",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: null,
      cacheHit: false,
      outcome: "budget_exceeded",
    },
    {
      userId: USER_B,
      feature: "mock-interview",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "smart",
      inputTokens: 300,
      outputTokens: 50,
      totalTokens: 350,
      costUsd: 0.1,
      cacheHit: false,
      outcome: "success",
    },
    {
      userId: USER_B,
      feature: "cv-analyze",
      provider: null,
      model: null,
      tier: "fast",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: null,
      cacheHit: false,
      outcome: "quota_exceeded",
    },
  ]);
  await testDb.insert(productEvents).values([
    { userId: USER_A, name: "job_search", metadata: { query: "React", region: "remote", resultCount: 5 } },
    { userId: USER_A, name: "job_search", metadata: { query: "react", region: "remote", resultCount: 3 } },
    { userId: USER_B, name: "job_search", metadata: { query: "Backend", region: "ua", resultCount: 2 } },
  ]);
});

describe("getOverview() (PGlite)", () => {
  it("counts all users/vacancies and sums LLM cost across the whole 30-day window", async () => {
    const overview = await getOverview(30);
    expect(overview.totalUsers).toBe(2);
    expect(overview.totalVacancies).toBe(3);
    // 5 rows total: USER_A has 2 success + 1 budget_exceeded, USER_B has 1 success + 1 quota_exceeded.
    expect(overview.llmCalls).toBe(5);
    expect(overview.llmCostUsd).toBeCloseTo(0.85, 8);
  });
});

describe("listUsersWithActivity() (PGlite)", () => {
  it("attributes vacancy/LLM-call counts to the correct user, never crossing over", async () => {
    const { users, total } = await listUsersWithActivity(50, 0);
    expect(total).toBe(2);
    const a = users.find((u) => u.id === USER_A);
    const b = users.find((u) => u.id === USER_B);
    expect(a?.vacancyCount).toBe(2);
    expect(a?.llmCallsRecent).toBe(3);
    expect(b?.vacancyCount).toBe(1);
    expect(b?.llmCallsRecent).toBe(2);
  });

  it("surfaces plan/status from the subscriptions LEFT JOIN, defaulting a missing row to free/inactive", async () => {
    const { users } = await listUsersWithActivity(50, 0);
    const a = users.find((u) => u.id === USER_A);
    const b = users.find((u) => u.id === USER_B);
    expect(a).toMatchObject({ plan: "pro", subStatus: "active" });
    expect(b).toMatchObject({ plan: "free", subStatus: "inactive" });
  });

  it("sums per-user recent LLM cost and counts blocked (budget/quota exceeded) calls separately per user", async () => {
    const { users } = await listUsersWithActivity(50, 0);
    const a = users.find((u) => u.id === USER_A);
    const b = users.find((u) => u.id === USER_B);
    expect(a?.llmCostRecentUsd).toBeCloseTo(0.75, 8);
    expect(a?.blockedCallsRecent).toBe(1);
    expect(b?.llmCostRecentUsd).toBeCloseTo(0.1, 8);
    expect(b?.blockedCallsRecent).toBe(1);
  });
});

describe("getLlmUsageSummary() (PGlite)", () => {
  it("aggregates cost/tokens by feature across all users", async () => {
    const summary = await getLlmUsageSummary(30);
    expect(summary.totalCalls).toBe(5);
    expect(summary.totalCostUsd).toBeCloseTo(0.85, 8);
    const cvReview = summary.byFeature.find((f) => f.feature === "cv-review");
    const mockInterview = summary.byFeature.find((f) => f.feature === "mock-interview");
    // cv-review now includes USER_A's budget_exceeded row too (0 tokens/cost, but a real call).
    expect(cvReview).toEqual(expect.objectContaining({ calls: 3, totalTokens: 1800, costUsd: expect.closeTo(0.75, 8) }));
    expect(mockInterview).toEqual(expect.objectContaining({ calls: 1, totalTokens: 350 }));
    // Sorted by cost descending — the admin's main "what's expensive" view.
    expect(summary.byFeature[0]?.feature).toBe("cv-review");
  });

  it("aggregates cost/calls by model and by tier, sorted by cost descending", async () => {
    const summary = await getLlmUsageSummary(30);
    // The two blocked rows have model: null (a cache-hit-shaped row never reached a provider) —
    // they form their own group rather than being dropped or merged into "gpt-4o-mini".
    expect(summary.byModel).toEqual([
      { model: "gpt-4o-mini", calls: 3, costUsd: expect.closeTo(0.85, 8) },
      { model: null, calls: 2, costUsd: 0 },
    ]);
    expect(summary.byTier).toEqual([
      { tier: "smart", calls: 4, costUsd: expect.closeTo(0.85, 8) },
      { tier: "fast", calls: 1, costUsd: 0 },
    ]);
  });

  it("surfaces budget_exceeded/quota_exceeded as a distinct byOutcome breakdown — previously invisible in the panel", async () => {
    const summary = await getLlmUsageSummary(30);
    const byOutcome = Object.fromEntries(summary.byOutcome.map((o) => [o.outcome, o.calls]));
    expect(byOutcome.success).toBe(3);
    expect(byOutcome.budget_exceeded).toBe(1);
    expect(byOutcome.quota_exceeded).toBe(1);
  });
});

describe("getBillingSummary() (PGlite)", () => {
  it("splits users into a synthesized free bucket plus each explicit paid plan/status row", async () => {
    const summary = await getBillingSummary(30);
    expect(summary.planCounts).toEqual(
      expect.arrayContaining([
        { plan: "free", status: "inactive", count: 1 },
        { plan: "pro", status: "active", count: 1 },
      ]),
    );
  });

  it("estimates MRR from active/trialing/past_due paid subscriptions only", async () => {
    const summary = await getBillingSummary(30);
    expect(summary.estimatedMrrUsd).toBe(9);
  });

  it("surfaces the same budget/quota exceeded counts as getLlmUsageSummary's byOutcome", async () => {
    const summary = await getBillingSummary(30);
    expect(summary.quotaExceededCount).toBe(1);
    expect(summary.budgetExceededCount).toBe(1);
  });
});

describe("getProductEventsSummary() (PGlite)", () => {
  it("counts events by name and finds top search queries case/whitespace-insensitively", async () => {
    const summary = await getProductEventsSummary(30);
    expect(summary.byName).toEqual([{ name: "job_search", count: 3 }]);
    const reactQuery = summary.topSearchQueries.find((q) => q.query === "react");
    expect(reactQuery?.count).toBe(2); // "React" and "react" merge into one bucket
    const backendQuery = summary.topSearchQueries.find((q) => q.query === "backend");
    expect(backendQuery?.count).toBe(1);
  });
});

describe("grantTemporaryPlan() (PGlite)", () => {
  it("upserts a new subscription row for a user who never had one (USER_B is on Free)", async () => {
    await grantTemporaryPlan(USER_A, USER_B, "pro", 30);
    const sub = await getSubscription(USER_B);
    expect(sub?.plan).toBe("pro");
    expect(sub?.status).toBe("active");
    expect(sub?.cancelAtPeriodEnd).toBe(false);
    const periodEnd = new Date(sub!.currentPeriodEnd!).getTime();
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(periodEnd - expected)).toBeLessThan(5000); // within 5s of "now + 30 days"
  });

  it("overwrites an existing plan/period end but preserves the Stripe linkage already on file (USER_A is on Pro via Stripe)", async () => {
    await grantTemporaryPlan(USER_A, USER_A, "team", 7);
    const sub = await getSubscription(USER_A);
    expect(sub?.plan).toBe("team");
    expect(sub?.stripeCustomerId).toBe("cus_admin_test"); // seeded in beforeAll, must survive the grant
    const periodEnd = new Date(sub!.currentPeriodEnd!).getTime();
    const expected = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(periodEnd - expected)).toBeLessThan(5000);
  });
});

describe("grantBonusAiCalls() (PGlite)", () => {
  it("adds to a user's standing bonus and returns the running total", async () => {
    const first = await grantBonusAiCalls(USER_A, USER_B, 25);
    expect(first).toBe(25);
    expect(await getAdminBonusAiCalls(USER_B)).toBe(25);

    const second = await grantBonusAiCalls(USER_A, USER_B, 10);
    expect(second).toBe(35);
  });

  it("floors a negative correction at 0 rather than going negative", async () => {
    await grantBonusAiCalls(USER_A, USER_A, 5);
    const corrected = await grantBonusAiCalls(USER_A, USER_A, -100);
    expect(corrected).toBe(0);
  });
});
