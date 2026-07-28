// Integration test against a REAL (in-process, PGlite) Postgres — proves bootstrapUser() seeds a
// brand-new user exactly once (idempotent) and never touches a different user's data.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "./test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "./user-id.js";
import { SEED_VACANCIES } from "./seed-vacancies.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let bootstrapUser: typeof import("./bootstrap.js").bootstrapUser;
let getProfile: typeof import("./kv.js").getProfile;
let listVacancies: typeof import("../modules/vacancies/vacancies.repo.js").listVacancies;

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("./client.js", () => ({ default: testDb }));
  bootstrapUser = (await import("./bootstrap.js")).bootstrapUser;
  getProfile = (await import("./kv.js")).getProfile;
  listVacancies = (await import("../modules/vacancies/vacancies.repo.js")).listVacancies;
});

describe("bootstrapUser() (PGlite)", () => {
  it("seeds a default profile and the full sample vacancy set for a brand-new user", async () => {
    await bootstrapUser(USER_A);
    const profile = await getProfile(USER_A);
    expect(profile.domain).toBe("Full-Stack Developer");
    const rows = await listVacancies(USER_A);
    expect(rows).toHaveLength(SEED_VACANCIES.length);
  });

  it("is idempotent — calling it again does not duplicate vacancies or reset the profile", async () => {
    const { setProfile } = await import("./kv.js");
    await setProfile(USER_A, { ...(await getProfile(USER_A)), domain: "Customized" });

    await bootstrapUser(USER_A);

    const profile = await getProfile(USER_A);
    expect(profile.domain).toBe("Customized"); // NOT reset back to the default
    const rows = await listVacancies(USER_A);
    expect(rows).toHaveLength(SEED_VACANCIES.length); // NOT duplicated
  });

  it("seeding one user does not create or affect rows for another user", async () => {
    await bootstrapUser(USER_B);
    const [rowsA, rowsB] = await Promise.all([listVacancies(USER_A), listVacancies(USER_B)]);
    expect(rowsB).toHaveLength(SEED_VACANCIES.length);
    expect(rowsA).toHaveLength(SEED_VACANCIES.length); // unaffected by seeding USER_B
    // Disjoint id sets — USER_B got its OWN rows, not a view onto USER_A's.
    const idsA = new Set(rowsA.map((v) => v.id));
    expect(rowsB.every((v) => !idsA.has(v.id))).toBe(true);
  });
});
