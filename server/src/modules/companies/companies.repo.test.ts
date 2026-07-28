// Integration test against a REAL (in-process, PGlite) Postgres — unlike the rest of the
// server's test suite (which stubs db/index.js with trivial mocks), this exercises the actual
// Drizzle queries and the real `companies_user_name_key` unique index, proving the multi-tenant
// scoping this repository is supposed to guarantee actually holds at the SQL level.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let listCompanies: typeof import("./companies.repo.js").listCompanies;
let upsertCompany: typeof import("./companies.repo.js").upsertCompany;
let findCompanyByName: typeof import("./companies.repo.js").findCompanyByName;

beforeAll(async () => {
  const testDb = await createTestDb();
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  const repo = await import("./companies.repo.js");
  listCompanies = repo.listCompanies;
  upsertCompany = repo.upsertCompany;
  findCompanyByName = repo.findCompanyByName;
});

describe("companies.repo (PGlite)", () => {
  it("upsertCompany() creates a new row, listCompanies() returns it scoped to that user", async () => {
    await upsertCompany(USER_A, { name: "Acme", notes: "great culture", questions: ["Why us?"] });
    const rows = await listCompanies(USER_A);
    expect(rows).toEqual([expect.objectContaining({ name: "Acme", notes: "great culture", questions: ["Why us?"] })]);
  });

  it("upsertCompany() updates notes/questions on a second call with the same name (same user)", async () => {
    await upsertCompany(USER_A, { name: "Acme", notes: "updated notes", questions: ["Q1", "Q2"] });
    const row = await findCompanyByName(USER_A, "Acme");
    expect(row).toEqual(expect.objectContaining({ notes: "updated notes", questions: ["Q1", "Q2"] }));
  });

  it("does NOT let one user's upsert overwrite another user's company with the same name (multi-tenant isolation)", async () => {
    await upsertCompany(USER_B, { name: "Acme", notes: "user B's notes", questions: [] });
    const [rowA, rowB] = await Promise.all([findCompanyByName(USER_A, "Acme"), findCompanyByName(USER_B, "Acme")]);
    expect(rowA?.notes).toBe("updated notes");
    expect(rowB?.notes).toBe("user B's notes");
  });

  it("listCompanies() never returns another user's rows", async () => {
    const rowsB = await listCompanies(USER_B);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]?.name).toBe("Acme");
    expect(rowsB[0]?.notes).toBe("user B's notes");
  });
});
