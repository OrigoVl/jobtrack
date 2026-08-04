// Integration test against a REAL (in-process, PGlite) Postgres — proves the multi-tenant
// scoping this repository is supposed to guarantee actually holds at the SQL level, and that the
// composite (user_id, company_id) FK (schema/app.ts) really does reject a cross-tenant link.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";
import { contacts } from "../../db/schema/index.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

const NEW_CONTACT = {
  name: "Ada Lovelace",
  role: "Engineering Manager",
  companyId: null as number | null,
  vacancyId: null as number | null,
  email: "ada@example.test",
  linkedinUrl: "https://www.linkedin.com/in/ada",
  notes: "Met at a meetup",
  lastContactAt: "",
};

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./contacts.repo.js");
let companiesRepo: typeof import("../companies/companies.repo.js");
let vacanciesRepo: typeof import("../vacancies/vacancies.repo.js");

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./contacts.repo.js");
  companiesRepo = await import("../companies/companies.repo.js");
  vacanciesRepo = await import("../vacancies/vacancies.repo.js");
});

describe("contacts.repo (PGlite)", () => {
  it("createContact() + listContacts() round-trips a contact scoped to that user", async () => {
    const contact = await repo.createContact(USER_A, NEW_CONTACT);
    expect(contact).toEqual(expect.objectContaining({ name: "Ada Lovelace", email: "ada@example.test" }));
    const rows = await repo.listContacts(USER_A);
    expect(rows.some((r) => r.id === contact.id)).toBe(true);
  });

  it("listContacts() never returns another user's rows", async () => {
    const contactB = await repo.createContact(USER_B, { ...NEW_CONTACT, name: "Bob's contact" });
    const rowsA = await repo.listContacts(USER_A);
    const rowsB = await repo.listContacts(USER_B);
    expect(rowsA.some((c) => c.id === contactB.id)).toBe(false);
    expect(rowsB.every((c) => c.name === "Bob's contact")).toBe(true);
  });

  it("getContact() returns undefined when the id belongs to a different user (not a leak, not a crash)", async () => {
    const contactA = await repo.createContact(USER_A, NEW_CONTACT);
    expect(await repo.getContact(USER_B, contactA.id)).toBeUndefined();
  });

  it("deleteContact() scoped to the wrong user deletes nothing", async () => {
    const contactA = await repo.createContact(USER_A, NEW_CONTACT);
    const deletedByB = await repo.deleteContact(USER_B, contactA.id);
    expect(deletedByB).toBe(0);
    expect(await repo.getContact(USER_A, contactA.id)).toBeDefined();
  });

  it("can link a contact to the caller's own company", async () => {
    await companiesRepo.upsertCompany(USER_A, { name: "Acme", notes: "", questions: [] });
    const company = await companiesRepo.findCompanyByName(USER_A, "Acme");
    const contact = await repo.createContact(USER_A, { ...NEW_CONTACT, companyId: company!.id });
    expect(contact.companyId).toBe(company!.id);
  });

  it("the composite FK rejects linking a contact to ANOTHER user's company at the SQL level", async () => {
    await companiesRepo.upsertCompany(USER_A, { name: "Only A's Co", notes: "", questions: [] });
    const companyOfA = await companiesRepo.findCompanyByName(USER_A, "Only A's Co");
    // Bypasses the repo/route-level ownership check on purpose — this proves the DB schema
    // itself (not just application code) makes this cross-tenant link impossible.
    await expect(
      testDb.insert(contacts).values({ userId: USER_B, name: "Cross-tenant attempt", companyId: companyOfA!.id }),
    ).rejects.toThrow();
  });

  it("can link a contact to a vacancy", async () => {
    const vacancyId = await vacanciesRepo.createVacancy(USER_A, {
      company: "Acme",
      position: "SWE",
      level: "",
      salary: "",
      url: "",
      status: "Applied",
      fit: "med",
      applied: "",
      next: "",
      notes: "",
      stack: [],
    });
    const contact = await repo.createContact(USER_A, { ...NEW_CONTACT, vacancyId });
    expect(contact.vacancyId).toBe(vacancyId);
  });

  it("deleting the linked vacancy unlinks the contact (SET NULL) instead of deleting it", async () => {
    const vacancyId = await vacanciesRepo.createVacancy(USER_A, {
      company: "Beta Corp",
      position: "SWE",
      level: "",
      salary: "",
      url: "",
      status: "Applied",
      fit: "med",
      applied: "",
      next: "",
      notes: "",
      stack: [],
    });
    const contact = await repo.createContact(USER_A, { ...NEW_CONTACT, name: "Recruiter for Beta", vacancyId });
    await vacanciesRepo.deleteVacancy(USER_A, vacancyId);
    const stillThere = await repo.getContact(USER_A, contact.id);
    expect(stillThere).toBeDefined();
    expect(stillThere?.vacancyId).toBeNull();
  });

  it("updateContact() partially updates without clobbering other fields", async () => {
    const contact = await repo.createContact(USER_A, NEW_CONTACT);
    const updated = await repo.updateContact(USER_A, contact.id, { role: "Staff Engineer" });
    expect(updated).toEqual(expect.objectContaining({ role: "Staff Engineer", email: "ada@example.test", name: "Ada Lovelace" }));
  });
});
