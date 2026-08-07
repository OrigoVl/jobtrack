// Integration test against a REAL (in-process, PGlite) Postgres — proves the TTL behavior of
// getEnrichmentCache()/setEnrichmentCache() actually holds at the SQL level, mirroring
// llm-cache.test.ts exactly but against the 7-day TTL of this (separate) table.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./test-db.js";
import { enrichmentCache } from "./schema/index.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let getEnrichmentCache: typeof import("./enrichment-cache.js").getEnrichmentCache;
let setEnrichmentCache: typeof import("./enrichment-cache.js").setEnrichmentCache;

beforeAll(async () => {
  testDb = await createTestDb();
  vi.doMock("./client.js", () => ({ default: testDb }));
  const repo = await import("./enrichment-cache.js");
  getEnrichmentCache = repo.getEnrichmentCache;
  setEnrichmentCache = repo.setEnrichmentCache;
});

describe("getEnrichmentCache()/setEnrichmentCache() (PGlite)", () => {
  it("returns null for a key that was never cached", async () => {
    expect(await getEnrichmentCache("nope")).toBeNull();
  });

  it("returns the cached value right after it was set", async () => {
    await setEnrichmentCache("fresh-key", [{ name: "Jane Doe" }]);
    expect(await getEnrichmentCache("fresh-key")).toEqual([{ name: "Jane Doe" }]);
  });

  it("treats a row older than the 7-day TTL as a miss", async () => {
    await setEnrichmentCache("stale-key", { value: "old" });
    const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago, past the 7-day TTL
    await testDb.update(enrichmentCache).set({ createdAt: staleDate }).where(eq(enrichmentCache.k, "stale-key"));

    expect(await getEnrichmentCache("stale-key")).toBeNull();
  });

  it("re-caching an expired key resets its createdAt, so it becomes a hit again instead of staying stuck expired", async () => {
    await setEnrichmentCache("expired-then-refreshed", { value: "old" });
    const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await testDb.update(enrichmentCache).set({ createdAt: staleDate }).where(eq(enrichmentCache.k, "expired-then-refreshed"));
    expect(await getEnrichmentCache("expired-then-refreshed")).toBeNull();

    await setEnrichmentCache("expired-then-refreshed", { value: "new" });

    expect(await getEnrichmentCache("expired-then-refreshed")).toEqual({ value: "new" });
  });
});
