// Integration test against a REAL (in-process, PGlite) Postgres — proves the TTL behavior added
// to getLlmCache()/setLlmCache() actually holds at the SQL level: a row past TTL_MS is treated as
// a miss, and re-caching that same key resets its createdAt so it doesn't stay stuck expired.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./test-db.js";
import { llmCache } from "./schema/index.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let getLlmCache: typeof import("./llm-cache.js").getLlmCache;
let setLlmCache: typeof import("./llm-cache.js").setLlmCache;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.doMock("./client.js", () => ({ default: testDb }));
  const repo = await import("./llm-cache.js");
  getLlmCache = repo.getLlmCache;
  setLlmCache = repo.setLlmCache;
});

describe("getLlmCache()/setLlmCache() (PGlite)", () => {
  it("returns null for a key that was never cached", async () => {
    expect(await getLlmCache("nope")).toBeNull();
  });

  it("returns the cached value right after it was set", async () => {
    await setLlmCache("fresh-key", { value: "hello" });
    expect(await getLlmCache("fresh-key")).toEqual({ value: "hello" });
  });

  it("treats a row older than the TTL as a miss", async () => {
    await setLlmCache("stale-key", { value: "old" });
    const staleDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago, past the 90-day TTL
    await testDb.update(llmCache).set({ createdAt: staleDate }).where(eq(llmCache.k, "stale-key"));

    expect(await getLlmCache("stale-key")).toBeNull();
  });

  it("re-caching an expired key resets its createdAt, so it becomes a hit again instead of staying stuck expired", async () => {
    await setLlmCache("expired-then-refreshed", { value: "old" });
    const staleDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    await testDb.update(llmCache).set({ createdAt: staleDate }).where(eq(llmCache.k, "expired-then-refreshed"));
    expect(await getLlmCache("expired-then-refreshed")).toBeNull();

    await setLlmCache("expired-then-refreshed", { value: "new" });

    expect(await getLlmCache("expired-then-refreshed")).toEqual({ value: "new" });
  });
});
