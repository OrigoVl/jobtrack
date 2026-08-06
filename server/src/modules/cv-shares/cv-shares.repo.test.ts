// Integration test against a REAL (in-process, PGlite) Postgres — proves generateShare()'s
// upsert-by-(userId,profileId) really does replace an old slug (not accumulate a second row),
// and that a slug only ever resolves to its own owner's profile.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let repo: typeof import("./cv-shares.repo.js");
let profilesRepo: typeof import("../cv/cv-profiles.repo.js");
let profileA: number;
let profileB: number;

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./cv-shares.repo.js");
  profilesRepo = await import("../cv/cv-profiles.repo.js");
  const emptyDoc = {
    name: "",
    title: "",
    contact: "",
    links: [],
    summary: "",
    photo: "",
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    theme: undefined,
  } as never;
  profileA = (await profilesRepo.createProfile(USER_A, { name: "CV 1", doc: emptyDoc, presets: [], position: 0 })).id;
  profileB = (await profilesRepo.createProfile(USER_B, { name: "CV 1", doc: emptyDoc, presets: [], position: 0 })).id;
});

describe("cv-shares.repo (PGlite)", () => {
  it("generateShare() creates a new, enabled share for a profile with none yet", async () => {
    const share = await repo.generateShare(USER_A, profileA);
    expect(share.enabled).toBe(true);
    expect(share.slug).toHaveLength(12);
    expect(await repo.getShareByProfile(USER_A, profileA)).toEqual(share);
  });

  it("calling generateShare() again REPLACES the slug — the old one stops resolving", async () => {
    const first = await repo.generateShare(USER_A, profileA);
    const second = await repo.generateShare(USER_A, profileA);
    expect(second.slug).not.toBe(first.slug);
    expect(await repo.getShareBySlug(first.slug)).toBeUndefined();
    expect(await repo.getShareBySlug(second.slug)).toEqual(
      expect.objectContaining({ slug: second.slug, userId: USER_A, profileId: profileA }),
    );
  });

  it("getShareBySlug() never returns another user's slug as if it were this user's", async () => {
    const shareA = await repo.generateShare(USER_A, profileA);
    const shareB = await repo.generateShare(USER_B, profileB);
    const rowA = await repo.getShareBySlug(shareA.slug);
    const rowB = await repo.getShareBySlug(shareB.slug);
    expect(rowA?.userId).toBe(USER_A);
    expect(rowB?.userId).toBe(USER_B);
  });

  it("setShareEnabled() toggles without changing the slug", async () => {
    const share = await repo.generateShare(USER_A, profileA);
    const disabled = await repo.setShareEnabled(USER_A, profileA, false);
    expect(disabled).toEqual({ slug: share.slug, enabled: false });
    const reEnabled = await repo.setShareEnabled(USER_A, profileA, true);
    expect(reEnabled).toEqual({ slug: share.slug, enabled: true });
  });

  it("setShareEnabled() for a profile with no share row affects nothing", async () => {
    const result = await repo.setShareEnabled("nobody" as UserId, 999999, true);
    expect(result).toBeUndefined();
  });
});
