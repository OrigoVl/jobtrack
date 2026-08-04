// Integration test against a REAL (in-process, PGlite) Postgres — same pattern as
// companies.repo.test.ts: proves the actual insert/cost-estimation behavior, not a mocked
// approximation of it. db/client.js is mocked via vi.doMock BEFORE the dynamic import below —
// telemetry.repo.ts itself imports db/client.js lazily (inside each function, not at module top
// level, see its own doc comment), so this mock is picked up the first time insertLlmUsage/
// insertProductEvent actually runs, same as for any other consumer.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, insertTestUser } from "../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../db/user-id.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let insertLlmUsage: typeof import("./telemetry.repo.js").insertLlmUsage;
let insertProductEvent: typeof import("./telemetry.repo.js").insertProductEvent;
let getUserCostUsdSince: typeof import("./telemetry.repo.js").getUserCostUsdSince;
let llmUsage: typeof import("../db/schema/index.js").llmUsage;
let productEvents: typeof import("../db/schema/index.js").productEvents;

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, BOOTSTRAP_USER_ID);
  vi.doMock("../db/client.js", () => ({ default: testDb }));
  const repo = await import("./telemetry.repo.js");
  insertLlmUsage = repo.insertLlmUsage;
  insertProductEvent = repo.insertProductEvent;
  getUserCostUsdSince = repo.getUserCostUsdSince;
  const schema = await import("../db/schema/index.js");
  llmUsage = schema.llmUsage;
  productEvents = schema.productEvents;
});

describe("insertLlmUsage() (PGlite)", () => {
  it("persists a successful call with an estimated cost for a known model", async () => {
    await insertLlmUsage({
      userId: BOOTSTRAP_USER_ID,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "fast",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cacheHit: false,
      latencyMs: 250,
      outcome: "success",
    });
    const [row] = await testDb.select().from(llmUsage).where(eq(llmUsage.feature, "cv-review"));
    expect(row).toBeTruthy();
    expect(row?.provider).toBe("openai");
    expect(row?.totalTokens).toBe(1500);
    // gpt-4o-mini: 0.15/1M in + 0.6/1M out -> 1000*0.15/1e6 + 500*0.6/1e6 = 0.00045
    expect(row?.costUsd).toBeCloseTo(0.00045, 8);
  });

  it("persists a cache hit with null provider/model/cost, not a misleading $0", async () => {
    await insertLlmUsage({
      userId: BOOTSTRAP_USER_ID,
      feature: "knowledge",
      provider: null,
      model: null,
      tier: "smart",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheHit: true,
      latencyMs: 0,
      outcome: "cache_hit",
    });
    const [row] = await testDb.select().from(llmUsage).where(eq(llmUsage.feature, "knowledge"));
    expect(row?.cacheHit).toBe(true);
    expect(row?.costUsd).toBeNull();
  });

  it("never throws when the DB insert itself would fail (e.g. a user id with no matching row)", async () => {
    await expect(
      insertLlmUsage({
        userId: "user-that-does-not-exist" as UserId,
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
      }),
    ).resolves.toBeUndefined();
  });
});

describe("getUserCostUsdSince() (PGlite)", () => {
  it("sums only this user's cost, scoped away from another user's usage", async () => {
    // Distinct userIds from BOOTSTRAP_USER_ID (used by the insertLlmUsage() describe block
    // above) — reusing it would make the sum here depend on test execution order within the
    // file, since every test shares the same PGlite instance/table.
    const userA = "user-cost-sum-a" as UserId;
    const userB = "user-cost-sum-b" as UserId;
    await insertTestUser(testDb, userA);
    await insertTestUser(testDb, userB);
    await insertLlmUsage({
      userId: userA,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "fast",
      inputTokens: 1000,
      outputTokens: 1000,
      totalTokens: 2000,
      cacheHit: false,
      latencyMs: 100,
      outcome: "success",
    });
    await insertLlmUsage({
      userId: userB,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "fast",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalTokens: 2_000_000,
      cacheHit: false,
      latencyMs: 100,
      outcome: "success",
    });
    // gpt-4o-mini: 0.15/1M in + 0.6/1M out -> 1000*0.15/1e6 + 1000*0.6/1e6 = 0.00075
    const cost = await getUserCostUsdSince(userA, new Date(0));
    expect(cost).toBeCloseTo(0.00075, 8);
  });

  it("excludes usage older than `since`", async () => {
    const userId = "user-cutoff" as UserId;
    await insertTestUser(testDb, userId);
    await insertLlmUsage({
      userId,
      feature: "cv-review",
      provider: "openai",
      model: "gpt-4o-mini",
      tier: "fast",
      inputTokens: 1_000_000,
      outputTokens: 0,
      totalTokens: 1_000_000,
      cacheHit: false,
      latencyMs: 100,
      outcome: "success",
    });
    await testDb
      .update(llmUsage)
      .set({ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) })
      .where(eq(llmUsage.userId, userId));

    const sinceYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(await getUserCostUsdSince(userId, sinceYesterday)).toBe(0);
    expect(await getUserCostUsdSince(userId, new Date(0))).toBeCloseTo(0.15, 8);
  });

  it("returns 0 for a user with no recorded usage", async () => {
    expect(await getUserCostUsdSince("user-with-no-usage" as UserId, new Date(0))).toBe(0);
  });
});

describe("insertProductEvent() (PGlite)", () => {
  it("persists an event with its metadata", async () => {
    await insertProductEvent(BOOTSTRAP_USER_ID, "job_search", { query: "react", region: "remote", resultCount: 12 });
    const [row] = await testDb.select().from(productEvents).where(eq(productEvents.name, "job_search"));
    expect(row?.metadata).toEqual({ query: "react", region: "remote", resultCount: 12 });
  });

  it("defaults metadata to {} when omitted", async () => {
    await insertProductEvent(BOOTSTRAP_USER_ID, "some_event");
    const [row] = await testDb.select().from(productEvents).where(eq(productEvents.name, "some_event"));
    expect(row?.metadata).toEqual({});
  });
});
