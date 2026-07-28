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
let llmUsage: typeof import("../../db/schema/index.js").llmUsage;
let productEvents: typeof import("../../db/schema/index.js").productEvents;
let vacancies: typeof import("../../db/schema/index.js").vacancies;

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
  const schema = await import("../../db/schema/index.js");
  llmUsage = schema.llmUsage;
  productEvents = schema.productEvents;
  vacancies = schema.vacancies;

  await testDb.insert(vacancies).values([
    { userId: USER_A, company: "Acme", position: "Engineer" },
    { userId: USER_A, company: "Beta", position: "Engineer" },
    { userId: USER_B, company: "Gamma", position: "Designer" },
  ]);
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
    expect(overview.llmCalls).toBe(3);
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
    expect(a?.llmCallsRecent).toBe(2);
    expect(b?.vacancyCount).toBe(1);
    expect(b?.llmCallsRecent).toBe(1);
  });
});

describe("getLlmUsageSummary() (PGlite)", () => {
  it("aggregates cost/tokens by feature across all users", async () => {
    const summary = await getLlmUsageSummary(30);
    expect(summary.totalCalls).toBe(3);
    expect(summary.totalCostUsd).toBeCloseTo(0.85, 8);
    const cvReview = summary.byFeature.find((f) => f.feature === "cv-review");
    const mockInterview = summary.byFeature.find((f) => f.feature === "mock-interview");
    expect(cvReview).toEqual(expect.objectContaining({ calls: 2, totalTokens: 1800, costUsd: expect.closeTo(0.75, 8) }));
    expect(mockInterview).toEqual(expect.objectContaining({ calls: 1, totalTokens: 350 }));
    // Sorted by cost descending — the admin's main "what's expensive" view.
    expect(summary.byFeature[0]?.feature).toBe("cv-review");
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
