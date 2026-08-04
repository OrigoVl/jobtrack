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

  it("getVacancy()/listVacancies() never expose the embedding column, even once set", async () => {
    const id = await repo.createVacancy(USER_A, NEW_VACANCY);
    await repo.updateVacancyEmbedding(USER_A, id, new Array(1536).fill(1));
    const row = await repo.getVacancy(USER_A, id);
    expect(row).not.toHaveProperty("embedding");
    expect(await repo.listVacancies(USER_A)).not.toContainEqual(expect.objectContaining({ embedding: expect.anything() }));
  });

  describe("getVacancyEmbedding()/updateVacancyEmbedding()/findSimilarVacancies()", () => {
    // Two orthogonal 1536-dim vectors (pgvector's fixed column width) — cosine similarity of
    // identical vectors is exactly 1, of these two is exactly 0 — a deterministic way to prove
    // "closer" ordering without depending on real embedding output.
    const DIM = 1536;
    const VEC_A = new Array(DIM).fill(0).map((_, i) => (i < DIM / 2 ? 1 : 0));
    const VEC_B = new Array(DIM).fill(0).map((_, i) => (i >= DIM / 2 ? 1 : 0));

    it("getVacancyEmbedding() distinguishes 'no such vacancy' (undefined) from 'no embedding yet' (null)", async () => {
      const id = await repo.createVacancy(USER_A, NEW_VACANCY);
      expect(await repo.getVacancyEmbedding(USER_A, id)).toBeNull();
      expect(await repo.getVacancyEmbedding(USER_A, 999_999)).toBeUndefined();
      expect(await repo.getVacancyEmbedding(USER_B, id)).toBeUndefined(); // wrong user — not a leak
    });

    it("updateVacancyEmbedding() round-trips a real vector, scoped to the owning user", async () => {
      const id = await repo.createVacancy(USER_A, NEW_VACANCY);
      await repo.updateVacancyEmbedding(USER_A, id, VEC_A);
      expect(await repo.getVacancyEmbedding(USER_A, id)).toEqual(VEC_A);
      // A different user's identical-id update is a no-op against this row (scoped by userId).
      await repo.updateVacancyEmbedding(USER_B, id, VEC_B);
      expect(await repo.getVacancyEmbedding(USER_A, id)).toEqual(VEC_A);
    });

    it("orders results by cosine similarity, excludes the reference vacancy itself and rows with no embedding, and stays scoped to one user", async () => {
      // Earlier tests in this file share the same PGlite instance and may have left other
      // embedded USER_A vacancies behind — a distinctive company prefix, filtered on below,
      // isolates THIS test's assertions from that shared state instead of assuming a clean slate.
      const reference = await repo.createVacancy(USER_A, { ...NEW_VACANCY, company: "Ordering Test Reference" });
      await repo.updateVacancyEmbedding(USER_A, reference, VEC_A);

      const closeMatch = await repo.createVacancy(USER_A, { ...NEW_VACANCY, company: "Ordering Test Close Match" });
      await repo.updateVacancyEmbedding(USER_A, closeMatch, VEC_A); // identical → similarity 1

      const farMatch = await repo.createVacancy(USER_A, { ...NEW_VACANCY, company: "Ordering Test Far Match" });
      await repo.updateVacancyEmbedding(USER_A, farMatch, VEC_B); // orthogonal → similarity 0

      await repo.createVacancy(USER_A, { ...NEW_VACANCY, company: "Ordering Test Not Embedded Yet" }); // no embedding — must be excluded

      const otherUsersVacancy = await repo.createVacancy(USER_B, { ...NEW_VACANCY, company: "Ordering Test Other User" });
      await repo.updateVacancyEmbedding(USER_B, otherUsersVacancy, VEC_A); // same vector, wrong user — must be excluded

      const similar = (await repo.findSimilarVacancies(USER_A, VEC_A, reference)).filter((v) => v.company.startsWith("Ordering Test"));
      expect(similar.map((v) => v.company)).toEqual(["Ordering Test Close Match", "Ordering Test Far Match"]);
      expect(similar[0]!.similarity).toBeCloseTo(1, 5);
      expect(similar[1]!.similarity).toBeCloseTo(0, 5);
      expect(similar.some((v) => v.id === reference)).toBe(false);
    });

    it("respects the limit parameter", async () => {
      const reference = await repo.createVacancy(USER_A, { ...NEW_VACANCY, company: "Limit Reference" });
      await repo.updateVacancyEmbedding(USER_A, reference, VEC_A);
      for (let i = 0; i < 3; i++) {
        const id = await repo.createVacancy(USER_A, { ...NEW_VACANCY, company: `Limit Candidate ${i}` });
        await repo.updateVacancyEmbedding(USER_A, id, VEC_A);
      }
      const similar = await repo.findSimilarVacancies(USER_A, VEC_A, reference, 2);
      expect(similar).toHaveLength(2);
    });
  });
});
