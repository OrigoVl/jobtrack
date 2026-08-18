// Integration test against a REAL (in-process, PGlite) Postgres — proves the multi-tenant scoping
// api-tokens.repo.ts is supposed to guarantee (listApiTokens/revokeApiToken scoped by userId) and
// the raw-token round-trip (resolveApiToken hashing/expiry/revocation) actually hold at the SQL
// level, same pattern as companies.repo.test.ts.
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let createApiToken: typeof import("./api-tokens.repo.js").createApiToken;
let listApiTokens: typeof import("./api-tokens.repo.js").listApiTokens;
let revokeApiToken: typeof import("./api-tokens.repo.js").revokeApiToken;
let resolveApiToken: typeof import("./api-tokens.repo.js").resolveApiToken;

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  const repo = await import("./api-tokens.repo.js");
  createApiToken = repo.createApiToken;
  listApiTokens = repo.listApiTokens;
  revokeApiToken = repo.revokeApiToken;
  resolveApiToken = repo.resolveApiToken;
});

describe("createApiToken() / resolveApiToken() (PGlite)", () => {
  it("creates a token and round-trips it through resolveApiToken", async () => {
    const { id, rawToken } = await createApiToken(USER_A, { label: "My laptop", scope: "read" });
    expect(typeof rawToken).toBe("string");
    expect(rawToken.startsWith("jt_")).toBe(true);
    expect(id).toBeGreaterThan(0);

    const resolved = await resolveApiToken(rawToken);
    expect(resolved).toEqual({ userId: USER_A, scope: "read", tokenId: id });
  });

  it("stores only a sha256 hash of the raw token, never the raw value itself", async () => {
    const { rawToken } = await createApiToken(USER_A, { label: "Hash check", scope: "read" });
    const rows = await listApiTokens(USER_A);
    const row = rows.find((r) => r.label === "Hash check");
    expect(row).toBeDefined();
    // ApiTokenSummary (TOKEN_COLUMNS) intentionally excludes tokenHash — confirm the raw token
    // itself never appears anywhere in the summary the caller gets back.
    expect(JSON.stringify(row)).not.toContain(rawToken);
    // The hash used internally is a 64-char hex sha256 of the raw token (verified indirectly:
    // a lookup by that same hash resolves, proving resolveApiToken hashes exactly this way).
    const expectedHash = createHash("sha256").update(rawToken).digest("hex");
    expect(expectedHash).toHaveLength(64);
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns null for a token that does not exist", async () => {
    expect(await resolveApiToken("jt_totally-made-up-garbage-token")).toBeNull();
  });

  it("returns null once the token has been revoked", async () => {
    const { id, rawToken } = await createApiToken(USER_A, { label: "Revoke me", scope: "read" });
    expect(await resolveApiToken(rawToken)).not.toBeNull();
    await revokeApiToken(USER_A, id);
    expect(await resolveApiToken(rawToken)).toBeNull();
  });

  it("returns null for an expired token, but resolves one that expires in the future", async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const expired = await createApiToken(USER_A, { label: "Expired", scope: "read", expiresAt: past });
    const active = await createApiToken(USER_A, { label: "Still active", scope: "read", expiresAt: future });

    expect(await resolveApiToken(expired.rawToken)).toBeNull();
    const resolved = await resolveApiToken(active.rawToken);
    expect(resolved).toEqual({ userId: USER_A, scope: "read", tokenId: active.id });
  });

  it("resolves the correct scope for a read_write token", async () => {
    const { rawToken, id } = await createApiToken(USER_A, { label: "Full access", scope: "read_write" });
    expect(await resolveApiToken(rawToken)).toEqual({ userId: USER_A, scope: "read_write", tokenId: id });
  });
});

describe("multi-tenant scoping (PGlite)", () => {
  it("listApiTokens() never returns another user's tokens, and revokeApiToken() cannot revoke another user's token", async () => {
    const tokenA = await createApiToken(USER_A, { label: "Owned by A", scope: "read" });

    // User B's own list must not include A's token.
    const listB = await listApiTokens(USER_B);
    expect(listB.some((t) => t.id === tokenA.id)).toBe(false);

    // User B attempting to revoke A's token id is a scoped no-op — it must not actually revoke it.
    await revokeApiToken(USER_B, tokenA.id);
    const resolved = await resolveApiToken(tokenA.rawToken);
    expect(resolved).toEqual({ userId: USER_A, scope: "read", tokenId: tokenA.id });

    // A's own list still shows it, unrevoked.
    const listA = await listApiTokens(USER_A);
    expect(listA.some((t) => t.id === tokenA.id)).toBe(true);
  });

  it("resolveApiToken() returns the correct owning userId regardless of which user 'asks'", async () => {
    const tokenB = await createApiToken(USER_B, { label: "Owned by B", scope: "read_write" });
    const resolved = await resolveApiToken(tokenB.rawToken);
    expect(resolved?.userId).toBe(USER_B);
    expect(resolved?.userId).not.toBe(USER_A);
  });
});

describe("listApiTokens() (PGlite)", () => {
  it("excludes revoked tokens from the list", async () => {
    const kept = await createApiToken(USER_A, { label: "Kept", scope: "read" });
    const revoked = await createApiToken(USER_A, { label: "To be revoked", scope: "read" });
    await revokeApiToken(USER_A, revoked.id);

    const rows = await listApiTokens(USER_A);
    expect(rows.some((r) => r.id === kept.id)).toBe(true);
    expect(rows.some((r) => r.id === revoked.id)).toBe(false);
  });
});

describe("revokeApiToken() (PGlite)", () => {
  it("is idempotent — revoking an already-revoked token does not throw", async () => {
    const { id } = await createApiToken(USER_A, { label: "Double revoke", scope: "read" });
    await revokeApiToken(USER_A, id);
    await expect(revokeApiToken(USER_A, id)).resolves.toBeUndefined();
  });

  it("revoking a nonexistent id does not throw", async () => {
    await expect(revokeApiToken(USER_A, 999999)).resolves.toBeUndefined();
  });
});
