// Integration test against a REAL (in-process, PGlite) Postgres — unlike the rest of the
// server's test suite (which stubs db/index.js with trivial mocks), this exercises the actual
// Drizzle queries and the real `companies_user_name_key` unique index, proving the multi-tenant
// scoping this repository is supposed to guarantee actually holds at the SQL level.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let listCompanies: typeof import("./companies.repo.js").listCompanies;
let upsertCompany: typeof import("./companies.repo.js").upsertCompany;
let upsertCompanyEnrichment: typeof import("./companies.repo.js").upsertCompanyEnrichment;
let findCompanyByName: typeof import("./companies.repo.js").findCompanyByName;
let updateCompany: typeof import("./companies.repo.js").updateCompany;
let deleteCompany: typeof import("./companies.repo.js").deleteCompany;

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  const repo = await import("./companies.repo.js");
  listCompanies = repo.listCompanies;
  upsertCompany = repo.upsertCompany;
  upsertCompanyEnrichment = repo.upsertCompanyEnrichment;
  findCompanyByName = repo.findCompanyByName;
  updateCompany = repo.updateCompany;
  deleteCompany = repo.deleteCompany;
});

describe("companies.repo (PGlite)", () => {
  it("upsertCompany() creates a new row, listCompanies() returns it scoped to that user", async () => {
    await upsertCompany(USER_A, { name: "Acme", notes: "great culture", questions: ["Why us?"] });
    const rows = await listCompanies(USER_A);
    expect(rows).toEqual([expect.objectContaining({ name: "Acme", notes: "great culture", questions: ["Why us?"], website: "" })]);
  });

  it("upsertCompany() persists a website, findCompanyByName() round-trips it", async () => {
    await upsertCompany(USER_A, { name: "WebsiteCo", notes: "", questions: [], website: "websiteco.com" });
    const row = await findCompanyByName(USER_A, "WebsiteCo");
    expect(row?.website).toBe("websiteco.com");
  });

  it("upsertCompany() without a website leaves it as '' (nullable column normalized at the API boundary)", async () => {
    await upsertCompany(USER_A, { name: "NoWebsiteCo", notes: "", questions: [] });
    const row = await findCompanyByName(USER_A, "NoWebsiteCo");
    expect(row?.website).toBe("");
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

describe("updateCompany() (PGlite)", () => {
  it("renames a company and updates its notes/questions by id", async () => {
    await upsertCompany(USER_A, { name: "Initech", notes: "old notes", questions: [] });
    const initech = await findCompanyByName(USER_A, "Initech");
    const updated = await updateCompany(USER_A, initech!.id, { name: "Initech Renamed", notes: "new notes", questions: ["Q1"] });
    expect(updated).toEqual(expect.objectContaining({ id: initech!.id, name: "Initech Renamed", notes: "new notes", questions: ["Q1"] }));
    expect(await findCompanyByName(USER_A, "Initech")).toBeUndefined();
  });

  it("updates a company's website by id", async () => {
    await upsertCompany(USER_A, { name: "WebUpdateCo", notes: "", questions: [] });
    const row = await findCompanyByName(USER_A, "WebUpdateCo");
    const updated = await updateCompany(USER_A, row!.id, { name: "WebUpdateCo", notes: "", questions: [], website: "webupdateco.com" });
    expect(updated?.website).toBe("webupdateco.com");
  });

  it("does not let one user update another user's company (returns undefined, row untouched)", async () => {
    const initech = await findCompanyByName(USER_A, "Initech Renamed");
    const updated = await updateCompany(USER_B, initech!.id, { name: "Hijacked", notes: "", questions: [] });
    expect(updated).toBeUndefined();
    expect(await findCompanyByName(USER_A, "Initech Renamed")).toBeDefined();
  });

  it("renaming into a name already used by another of this user's companies violates the unique index", async () => {
    await upsertCompany(USER_A, { name: "Umbrella", notes: "", questions: [] });
    const initech = await findCompanyByName(USER_A, "Initech Renamed");
    // The repo function itself does no pre-check — companies.routes.ts's PUT handler is
    // responsible for calling findCompanyByName first and turning this into a clean 409 before
    // ever reaching here (see updateCompany's own comment).
    await expect(updateCompany(USER_A, initech!.id, { name: "Umbrella", notes: "", questions: [] })).rejects.toThrow();
  });
});

describe("upsertCompanyEnrichment() (PGlite)", () => {
  it("creates the row and returns it, so the caller can link a vacancy to its id", async () => {
    const row = await upsertCompanyEnrichment(USER_A, {
      name: "King Group",
      notes: "iGaming product company.",
      questions: ["How is the frontend team structured?"],
      website: "kinggroup.com",
    });
    expect(row).toEqual(
      expect.objectContaining({
        name: "King Group",
        notes: "iGaming product company.",
        questions: ["How is the frontend team structured?"],
        website: "kinggroup.com",
      }),
    );
    expect(row.id).toBeGreaterThan(0);
  });

  it("never overwrites notes/questions/website the user already filled in", async () => {
    await upsertCompany(USER_A, { name: "Handwritten", notes: "my own notes", questions: ["mine?"], website: "mine.com" });
    const row = await upsertCompanyEnrichment(USER_A, {
      name: "Handwritten",
      notes: "generated notes",
      questions: ["generated?"],
      website: "generated.com",
    });
    expect(row).toEqual(expect.objectContaining({ notes: "my own notes", questions: ["mine?"], website: "mine.com" }));
  });

  it("fills only the fields that are still empty on an existing row", async () => {
    await upsertCompany(USER_A, { name: "PartlyFilled", notes: "notes I wrote", questions: [] });
    const row = await upsertCompanyEnrichment(USER_A, {
      name: "PartlyFilled",
      notes: "generated notes",
      questions: ["generated?"],
      website: "partly.com",
    });
    expect(row.notes).toBe("notes I wrote");
    expect(row.questions).toEqual(["generated?"]);
    expect(row.website).toBe("partly.com");
  });

  it("is idempotent — importing a second vacancy from the same employer creates no duplicate row", async () => {
    const first = await upsertCompanyEnrichment(USER_A, { name: "Repeated", notes: "n", questions: [] });
    const second = await upsertCompanyEnrichment(USER_A, { name: "Repeated", notes: "n", questions: [] });
    expect(second.id).toBe(first.id);
    expect((await listCompanies(USER_A)).filter((c) => c.name === "Repeated")).toHaveLength(1);
  });

  it("scopes by user — the same employer name in two accounts stays two separate rows", async () => {
    const a = await upsertCompanyEnrichment(USER_A, { name: "SharedName", notes: "a's notes", questions: [] });
    const b = await upsertCompanyEnrichment(USER_B, { name: "SharedName", notes: "b's notes", questions: [] });
    expect(b.id).not.toBe(a.id);
    expect((await findCompanyByName(USER_A, "SharedName"))?.notes).toBe("a's notes");
    expect((await findCompanyByName(USER_B, "SharedName"))?.notes).toBe("b's notes");
  });
});

describe("deleteCompany() (PGlite)", () => {
  it("does not let one user delete another user's company", async () => {
    await upsertCompany(USER_B, { name: "Globex", notes: "", questions: [] });
    const globex = await findCompanyByName(USER_B, "Globex");
    const deleted = await deleteCompany(USER_A, globex!.id);
    expect(deleted).toBe(0);
    expect(await findCompanyByName(USER_B, "Globex")).toBeDefined();
  });

  it("removes the row and reports 1 row deleted", async () => {
    const globex = await findCompanyByName(USER_B, "Globex");
    const deleted = await deleteCompany(USER_B, globex!.id);
    expect(deleted).toBe(1);
    expect(await findCompanyByName(USER_B, "Globex")).toBeUndefined();
  });
});
