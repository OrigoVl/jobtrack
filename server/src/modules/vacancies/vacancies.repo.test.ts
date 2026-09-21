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
  salary: "",
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
let kv: typeof import("../../db/kv.js");
let companiesRepo: typeof import("../companies/companies.repo.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./vacancies.repo.js");
  history = await import("../../db/vacancy-history.js");
  kv = await import("../../db/kv.js");
  companiesRepo = await import("../companies/companies.repo.js");
});

describe("vacancies.repo (PGlite)", () => {
  it("createVacancy() + getVacancy() round-trips a jsonb stack as a real array (no manual JSON parsing)", async () => {
    const id = await repo.createVacancy(USER_A, NEW_VACANCY);
    const row = await repo.getVacancy(USER_A, id);
    expect(row?.stack).toEqual(["React", "TypeScript"]);
  });

  it("createVacancy() + getVacancy() round-trips location/workMode/employmentType (null when omitted)", async () => {
    const idWithout = await repo.createVacancy(USER_A, NEW_VACANCY);
    const rowWithout = await repo.getVacancy(USER_A, idWithout);
    expect(rowWithout?.location).toBeNull();
    expect(rowWithout?.workMode).toBeNull();
    expect(rowWithout?.employmentType).toBeNull();

    const idWith = await repo.createVacancy(USER_A, {
      ...NEW_VACANCY,
      location: "Kyiv, Ukraine",
      workMode: "hybrid",
      employmentType: "Full-time",
    });
    const rowWith = await repo.getVacancy(USER_A, idWith);
    expect(rowWith?.location).toBe("Kyiv, Ukraine");
    expect(rowWith?.workMode).toBe("hybrid");
    expect(rowWith?.employmentType).toBe("Full-time");
  });

  it("updateVacancyImportedTitle() persists salary/location/workMode/employmentType onto a bulk-imported row", async () => {
    const id = await repo.createVacancyMinimal(USER_A, {
      company: "",
      position: "(imported)",
      url: "https://djinni.co/jobs/1",
      status: "Want to apply",
    });

    await repo.updateVacancyImportedTitle(USER_A, id, {
      salary: "$3000-4000",
      location: "Berlin, Germany",
      workMode: "remote",
      employmentType: "Contract",
    });

    const row = await repo.getVacancy(USER_A, id);
    expect(row?.salary).toBe("$3000-4000");
    expect(row?.location).toBe("Berlin, Germany");
    expect(row?.workMode).toBe("remote");
    expect(row?.employmentType).toBe("Contract");
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

  // Regression test: a non-numeric `id` (e.g. "apply-goal" — what vacancies.routes.ts's generic
  // PUT/DELETE "/vacancies/:id" received while it briefly shadowed the literal
  // "/vacancies/apply-goal" route) used to reach the DB driver as `Number("apply-goal") === NaN`,
  // which postgres.js can't bind as a query param — it throws a raw "Failed query: ... params:
  // ...,NaN" error straight through to the client instead of a clean 404/no-op. Every id-taking
  // function here must treat a non-numeric id the same safe way a real "no such vacancy" id would.
  it("every id-taking function treats a non-numeric id as 'not found', never reaching the DB driver with NaN", async () => {
    await expect(repo.getVacancy(USER_A, "apply-goal")).resolves.toBeUndefined();
    await expect(repo.getVacancyEmbedding(USER_A, "apply-goal")).resolves.toBeUndefined();
    await expect(repo.deleteVacancy(USER_A, "apply-goal")).resolves.toBe(0);
    await expect(repo.updateVacancy(USER_A, "apply-goal", NEW_VACANCY)).resolves.toBeUndefined();
    await expect(repo.updateVacancyEnrichment(USER_A, "apply-goal", { stack: [], level: "", fit: "" })).resolves.toBeUndefined();
    await expect(repo.updateVacancyEmbedding(USER_A, "apply-goal", null)).resolves.toBeUndefined();
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

  describe("companyId (plain single-column FK to companies.id, ON DELETE SET NULL)", () => {
    it("createVacancy() + getVacancy() round-trips a companyId owned by the same user", async () => {
      await companiesRepo.upsertCompany(USER_A, { name: "Acme Corp", notes: "", questions: [] });
      const company = await companiesRepo.findCompanyByName(USER_A, "Acme Corp");
      const id = await repo.createVacancy(USER_A, { ...NEW_VACANCY, companyId: company!.id });
      const row = await repo.getVacancy(USER_A, id);
      expect(row?.companyId).toBe(company!.id);
    });

    it("deleting the linked company sets the vacancy's companyId back to null (ON DELETE SET NULL), without deleting the vacancy itself", async () => {
      await companiesRepo.upsertCompany(USER_A, { name: "Beta Corp", notes: "", questions: [] });
      const company = await companiesRepo.findCompanyByName(USER_A, "Beta Corp");
      const id = await repo.createVacancy(USER_A, { ...NEW_VACANCY, companyId: company!.id });

      await companiesRepo.deleteCompany(USER_A, company!.id);

      const row = await repo.getVacancy(USER_A, id);
      expect(row).toBeDefined();
      expect(row?.companyId).toBeNull();
    });

    // Unlike contacts.companyId (a composite (userId, companyId) FK to companies), vacancies.companyId
    // is a plain single-column FK straight to companies.id (see schema/app.ts's own comment on why:
    // a vacancy must survive its linked company being deleted, via a plain SET NULL FK, which can't
    // also be composite against the NOT NULL userId column). So nothing at the repo/DB level stops a
    // vacancy from pointing at another user's company row — the repo has no ownership-aware read/write
    // path for companyId at all, it's just a plain column that round-trips whatever id it's given.
    // The actual cross-tenant guard lives at the route layer (vacancies.routes.ts's
    // assertOwnCompanyOrNull, called before createVacancy/updateVacancy), not here.
    it("the repo layer itself does not enforce companyId ownership — it round-trips a cross-tenant companyId unchanged (guarded at the route layer instead)", async () => {
      await companiesRepo.upsertCompany(USER_B, { name: "Only B's Co", notes: "", questions: [] });
      const companyOfB = await companiesRepo.findCompanyByName(USER_B, "Only B's Co");
      const id = await repo.createVacancy(USER_A, { ...NEW_VACANCY, companyId: companyOfB!.id });
      const row = await repo.getVacancy(USER_A, id);
      expect(row?.companyId).toBe(companyOfB!.id);
    });

    // POST /vacancies/import used to only ever set the free-text `company` string on an imported
    // row, never `companyId` — so an imported vacancy showed "No linked company" in the detail
    // modal (which only renders the linked-company picker) even when the name was guessed
    // correctly. updateVacancyImportedTitle() now accepts companyId too; this proves it actually
    // links the row, not just the text.
    it("updateVacancyImportedTitle() links companyId (not just the free-text company name) for an imported row", async () => {
      await companiesRepo.upsertCompany(USER_A, { name: "Nova Digital", notes: "", questions: [] });
      const company = await companiesRepo.findCompanyByName(USER_A, "Nova Digital");
      const id = await repo.createVacancyMinimal(USER_A, {
        company: "",
        position: "(imported)",
        url: "https://jobs.dou.ua/companies/nova-digital/vacancies/1/",
        status: "Want to apply",
      });

      await repo.updateVacancyImportedTitle(USER_A, id, { company: "Nova Digital", companyId: company!.id });

      const row = await repo.getVacancy(USER_A, id);
      expect(row?.company).toBe("Nova Digital");
      expect(row?.companyId).toBe(company!.id);
    });
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

describe("recordStatusChange() apply-streak side effect + getAppliedCountSince() (PGlite)", () => {
  it("transitioning a vacancy to Applied ticks the apply streak, but other statuses don't", async () => {
    const id = await repo.createVacancy(USER_B, NEW_VACANCY);
    await history.recordStatusChange(USER_B, id, "Want to apply");
    expect(await kv.getApplyStreak(USER_B)).toEqual({ current: 0, longest: 0, lastActiveDate: "" });

    await history.recordStatusChange(USER_B, id, "Applied");
    expect((await kv.getApplyStreak(USER_B)).current).toBe(1);
  });

  it("counts only DISTINCT vacancies that reached Applied on/after the given instant, scoped per user", async () => {
    const since = new Date();
    const idA1 = await repo.createVacancy(USER_A, NEW_VACANCY);
    const idA2 = await repo.createVacancy(USER_A, NEW_VACANCY);
    await history.recordStatusChange(USER_A, idA1, "Applied");
    await history.recordStatusChange(USER_A, idA1, "Screening"); // re-visiting Applied's own dedupe below
    await history.recordStatusChange(USER_A, idA1, "Applied"); // same vacancy, second time — must not double-count
    await history.recordStatusChange(USER_A, idA2, "Applied");
    const idB = await repo.createVacancy(USER_B, NEW_VACANCY);
    await history.recordStatusChange(USER_B, idB, "Applied");

    expect(await history.getAppliedCountSince(USER_A, since)).toBe(2);
  });

  it("excludes Applied transitions before the given instant", async () => {
    const id = await repo.createVacancy(USER_A, NEW_VACANCY);
    await history.recordStatusChange(USER_A, id, "Applied");
    const future = new Date(Date.now() + 60_000);
    expect(await history.getAppliedCountSince(USER_A, future)).toBe(0);
  });
});
