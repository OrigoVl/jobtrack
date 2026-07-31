// Integration test against a REAL (in-process, PGlite) Postgres — proves generateShare()'s
// upsert-by-userId really does replace an old slug (not accumulate a second row), and that a
// slug only ever resolves to its own owner's data.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let repo: typeof import("./cv-shares.repo.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./cv-shares.repo.js");
});

describe("cv-shares.repo (PGlite)", () => {
  it("generateShare() creates a new, enabled share for a user with none yet", async () => {
    const share = await repo.generateShare(USER_A);
    expect(share.enabled).toBe(true);
    expect(share.slug).toHaveLength(12);
    expect(await repo.getShareByUserId(USER_A)).toEqual(share);
  });

  it("calling generateShare() again REPLACES the slug — the old one stops resolving", async () => {
    const first = await repo.generateShare(USER_A);
    const second = await repo.generateShare(USER_A);
    expect(second.slug).not.toBe(first.slug);
    expect(await repo.getShareBySlug(first.slug)).toBeUndefined();
    expect(await repo.getShareBySlug(second.slug)).toEqual(expect.objectContaining({ slug: second.slug, userId: USER_A }));
  });

  it("getShareBySlug() never returns another user's slug as if it were this user's", async () => {
    const shareA = await repo.generateShare(USER_A);
    const shareB = await repo.generateShare(USER_B);
    const rowA = await repo.getShareBySlug(shareA.slug);
    const rowB = await repo.getShareBySlug(shareB.slug);
    expect(rowA?.userId).toBe(USER_A);
    expect(rowB?.userId).toBe(USER_B);
  });

  it("setShareEnabled() toggles without changing the slug", async () => {
    const share = await repo.generateShare(USER_A);
    const disabled = await repo.setShareEnabled(USER_A, false);
    expect(disabled).toEqual({ slug: share.slug, enabled: false });
    const reEnabled = await repo.setShareEnabled(USER_A, true);
    expect(reEnabled).toEqual({ slug: share.slug, enabled: true });
  });

  it("setShareEnabled() for a user with no share row affects nothing", async () => {
    const result = await repo.setShareEnabled("nobody" as UserId, true);
    expect(result).toBeUndefined();
  });
});
