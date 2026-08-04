// Integration test against a REAL (in-process, PGlite) Postgres — proves the digest preferences
// CRUD stays scoped to the caller, AND that listDigestEnabledUsers() (the scheduler's one
// deliberately unscoped query) only ever returns opted-in users, joined to their OWN email.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let repo: typeof import("./digest.repo.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A, "alice@example.test");
  await insertTestUser(testDb, USER_B, "bob@example.test");
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./digest.repo.js");
});

describe("digest.repo (PGlite)", () => {
  it("getDigestPreferences() defaults to disabled/never-sent for a user with no row yet", async () => {
    expect(await repo.getDigestPreferences(USER_A)).toEqual({ enabled: false, lastSentAt: null });
  });

  it("setDigestEnabled() creates the row on first call and toggles it on subsequent calls", async () => {
    expect(await repo.setDigestEnabled(USER_A, true)).toEqual({ enabled: true, lastSentAt: null });
    expect(await repo.getDigestPreferences(USER_A)).toEqual({ enabled: true, lastSentAt: null });
    expect(await repo.setDigestEnabled(USER_A, false)).toEqual({ enabled: false, lastSentAt: null });
  });

  it("listDigestEnabledUsers() only returns opted-in users, joined to their own email", async () => {
    await repo.setDigestEnabled(USER_A, true);
    await repo.setDigestEnabled(USER_B, false);
    const users = await repo.listDigestEnabledUsers();
    expect(users.some((u) => u.userId === USER_B)).toBe(false);
    const rowA = users.find((u) => u.userId === USER_A);
    expect(rowA?.userEmail).toBe("alice@example.test");
  });

  it("recordDigestSent() sets lastSentAt only for an enabled user", async () => {
    await repo.setDigestEnabled(USER_A, true);
    await repo.recordDigestSent(USER_A);
    const prefs = await repo.getDigestPreferences(USER_A);
    expect(prefs.enabled).toBe(true);
    expect(prefs.lastSentAt).not.toBeNull();
  });

  it("recordDigestSent() is a no-op for a user who has since disabled the digest", async () => {
    await repo.setDigestEnabled(USER_B, false);
    await repo.recordDigestSent(USER_B);
    expect((await repo.getDigestPreferences(USER_B)).lastSentAt).toBeNull();
  });
});
