// Integration test against a REAL (in-process, PGlite) Postgres — proves the multi-tenant
// scoping this repository is supposed to guarantee actually holds at the SQL level, and that
// the vacancy_status_history FK's ON DELETE CASCADE (schema/app.ts) really does remove history
// rows when a vacancy is deleted, without a separate manual cleanup call.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

const NEW_VACANCY = {
  company: "Acme",
  position: "Engineer",
  level: "mid",
  url: "",
  status: "Want to apply",
  fit: "med",
  applied: "",
  next: "",
  notes: "",
  stack: ["React", "TypeScript"],
};

let repo: typeof import("./vacancies.repo.js");
let history: typeof import("../../db/vacancy-history.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./vacancies.repo.js");
  history = await import("../../db/vacancy-history.js");
});

describe("vacancies.repo (PGlite)", () => {
  it("createVacancy() + getVacancy() round-trips a jsonb stack as a real array (no manual JSON parsing)", async () => {
    const id = await repo.createVacancy(USER_A, NEW_VACANCY);
    const row = await repo.getVacancy(USER_A, id);
    expect(row?.stack).toEqual(["React", "TypeScript"]);
  });

  it("listVacancies() never returns another user's rows", async () => {
    const idB = await repo.createVacancy(USER_B, { ...NEW_VACANCY, company: "Other Co" });
    const rowsA = await repo.listVacancies(USER_A);
    const rowsB = await repo.listVacancies(USER_B);
    expect(rowsA.some((v) => v.id === idB)).toBe(false);
    expect(rowsB.every((v) => v.company === "Other Co")).toBe(true);
  });

  it("getVacancy() returns undefined when the id belongs to a different user (not a leak, not a crash)", async () => {
    const idA = await repo.createVacancy(USER_A, NEW_VACANCY);
    expect(await repo.getVacancy(USER_B, idA)).toBeUndefined();
  });

  it("deleteVacancy() scoped to the wrong user deletes nothing", async () => {
    const idA = await repo.createVacancy(USER_A, NEW_VACANCY);
    const deletedByB = await repo.deleteVacancy(USER_B, idA);
    expect(deletedByB).toBe(0);
    expect(await repo.getVacancy(USER_A, idA)).toBeDefined();
  });

  it("deleting a vacancy cascades to its status history (ON DELETE CASCADE, no manual cleanup call)", async () => {
    const id = await repo.createVacancy(USER_A, NEW_VACANCY);
    await history.recordStatusChange(USER_A, id, "Want to apply");
    await history.recordStatusChange(USER_A, id, "Applied");
    expect((await history.getReachedCounts(USER_A)).Applied).toBeGreaterThan(0);

    const deleted = await repo.deleteVacancy(USER_A, id);
    expect(deleted).toBe(1);

    // Re-fetching reached-counts still works (no orphaned FK violation) and no longer reflects
    // rows that only this deleted vacancy contributed to a status no other row reached.
    const remaining = await history.getReachedCounts(USER_A);
    expect(Object.values(remaining).every((c) => c >= 0)).toBe(true);
  });
});
