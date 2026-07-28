// Integration test against a REAL (in-process, PGlite) Postgres — same pattern as
// companies.repo.test.ts: proves the export actually pulls this user's rows from every
// relevant table (and only this user's) at the SQL level.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let exportAccountData: typeof import("./account.service.js").exportAccountData;

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  const service = await import("./account.service.js");
  exportAccountData = service.exportAccountData;

  const schema = await import("../../db/schema/index.js");
  await testDb.insert(schema.userKv).values([
    { userId: USER_A, k: "profile", v: { domain: "Frontend Developer", skills: ["React"] } },
    { userId: USER_B, k: "profile", v: { domain: "Backend Developer", skills: ["Go"] } },
  ]);
  const [vacancyA] = await testDb.insert(schema.vacancies).values({ userId: USER_A, company: "Acme", position: "Engineer" }).returning();
  await testDb.insert(schema.vacancies).values({ userId: USER_B, company: "Globex", position: "Designer" });
  await testDb.insert(schema.companies).values([
    { userId: USER_A, name: "Acme" },
    { userId: USER_B, name: "Globex" },
  ]);
  await testDb.insert(schema.vacancyStatusHistory).values({ userId: USER_A, vacancyId: vacancyA!.id, status: "Applied" });
  await testDb.insert(schema.srs).values([
    { userId: USER_A, cardId: "card-1", reps: 2 },
    { userId: USER_B, cardId: "card-1", reps: 5 },
  ]);
});

describe("exportAccountData() (PGlite)", () => {
  it("returns only this user's rows across every table, never another user's", async () => {
    const data = await exportAccountData(USER_A);
    expect(data.profile).toEqual({ profile: { domain: "Frontend Developer", skills: ["React"] } });
    expect(data.vacancies).toHaveLength(1);
    expect(data.vacancies[0]?.company).toBe("Acme");
    expect(data.companies).toEqual([expect.objectContaining({ name: "Acme" })]);
    expect(data.vacancyStatusHistory).toHaveLength(1);
    expect(data.srs).toEqual([expect.objectContaining({ cardId: "card-1", reps: 2 })]);
    expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("the other user's export is fully independent (isolation, not just filtering by coincidence)", async () => {
    const data = await exportAccountData(USER_B);
    expect(data.profile).toEqual({ profile: { domain: "Backend Developer", skills: ["Go"] } });
    expect(data.vacancies).toEqual([expect.objectContaining({ company: "Globex" })]);
    expect(data.vacancyStatusHistory).toEqual([]);
    expect(data.srs).toEqual([expect.objectContaining({ cardId: "card-1", reps: 5 })]);
  });
});
