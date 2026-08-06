// Integration test against a REAL (in-process, PGlite) Postgres — proves multi-tenant scoping for
// the CV profiles CRUD at the SQL level, and that doc/presets round-trip through CvDocSchema/
// CvPresetsSchema on every read (same "schema re-validates on read" convention as the old
// single-blob cvDoc storage).
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";
import { CvDocSchema, CvPresetsSchema, type CvDoc, type CvPreset } from "./cv.schemas.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

const testDoc = (name = ""): CvDoc => CvDocSchema.parse({ name });
const testPresets = (name = "Compact"): CvPreset[] => CvPresetsSchema.parse([{ name, theme: {} }]);

let repo: typeof import("./cv-profiles.repo.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./cv-profiles.repo.js");
});

describe("cv-profiles.repo (PGlite)", () => {
  it("createProfile() + listProfiles() round-trips, ordered by position", async () => {
    const first = await repo.createProfile(USER_A, { name: "CV 1", doc: testDoc("Alice"), presets: [], position: 0 });
    const second = await repo.createProfile(USER_A, { name: "CV 2", doc: testDoc(), presets: [], position: 1 });
    const list = await repo.listProfiles(USER_A);
    expect(list.map((p) => p.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(list.findIndex((p) => p.id === first.id)).toBeLessThan(list.findIndex((p) => p.id === second.id));
  });

  it("listProfiles()/countProfiles() never return another user's rows", async () => {
    await repo.createProfile(USER_B, { name: "Bob's CV", doc: testDoc("Bob"), presets: [], position: 0 });
    const listA = await repo.listProfiles(USER_A);
    const listB = await repo.listProfiles(USER_B);
    expect(listA.every((p) => p.name !== "Bob's CV")).toBe(true);
    expect(listB).toEqual([expect.objectContaining({ name: "Bob's CV" })]);
    expect(await repo.countProfiles(USER_B)).toBe(1);
  });

  it("getProfileFull() scoped to the wrong user returns undefined", async () => {
    const profile = await repo.createProfile(USER_A, { name: "Scoped", doc: testDoc("Carol"), presets: [], position: 5 });
    expect(await repo.getProfileFull(USER_B, profile.id)).toBeUndefined();
    expect(await repo.getProfileFull(USER_A, profile.id)).toEqual(
      expect.objectContaining({ name: "Scoped", doc: expect.objectContaining({ name: "Carol" }) }),
    );
  });

  it("updateProfileDoc() persists and re-validates through CvDocSchema", async () => {
    const profile = await repo.createProfile(USER_A, { name: "Doc test", doc: testDoc(), presets: [], position: 9 });
    const updated = await repo.updateProfileDoc(USER_A, profile.id, testDoc("Updated Name"));
    expect(updated?.name).toBe("Updated Name");
    expect((await repo.getProfileFull(USER_A, profile.id))?.doc.name).toBe("Updated Name");
  });

  it("updateProfileDoc() scoped to the wrong user updates nothing", async () => {
    const profile = await repo.createProfile(USER_A, { name: "Guarded", doc: testDoc("Original"), presets: [], position: 10 });
    const result = await repo.updateProfileDoc(USER_B, profile.id, testDoc("Hacked"));
    expect(result).toBeUndefined();
    expect((await repo.getProfileFull(USER_A, profile.id))?.doc.name).toBe("Original");
  });

  it("updateProfilePresets() round-trips", async () => {
    const profile = await repo.createProfile(USER_A, { name: "Presets test", doc: testDoc(), presets: [], position: 11 });
    const result = await repo.updateProfilePresets(USER_A, profile.id, testPresets("Compact"));
    expect(result?.[0]?.name).toBe("Compact");
    expect((await repo.getProfileFull(USER_A, profile.id))?.presets[0]?.name).toBe("Compact");
  });

  it("renameProfile() scoped to the wrong user renames nothing", async () => {
    const profile = await repo.createProfile(USER_A, { name: "Original name", doc: testDoc(), presets: [], position: 12 });
    const result = await repo.renameProfile(USER_B, profile.id, "Hacked name");
    expect(result).toBeUndefined();
    expect((await repo.getProfileFull(USER_A, profile.id))?.name).toBe("Original name");
  });

  it("deleteProfile() scoped to the wrong user deletes nothing; scoped to the right user deletes it", async () => {
    const profile = await repo.createProfile(USER_A, { name: "To keep", doc: testDoc(), presets: [], position: 13 });
    expect(await repo.deleteProfile(USER_B, profile.id)).toBe(0);
    expect(await repo.getProfileFull(USER_A, profile.id)).toBeDefined();
    expect(await repo.deleteProfile(USER_A, profile.id)).toBe(1);
    expect(await repo.getProfileFull(USER_A, profile.id)).toBeUndefined();
  });
});
