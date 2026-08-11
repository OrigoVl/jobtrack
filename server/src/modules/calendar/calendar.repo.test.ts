// Integration test against a REAL (in-process, PGlite) Postgres — unlike the rest of the
// server's test suite (which stubs db/index.js with trivial mocks), this exercises the actual
// Drizzle queries AND the `calendar_events` composite FK (schema/app.ts), proving:
//   1. listCalendarEvents()/createCalendarEvent()/etc. are correctly scoped per user.
//   2. The composite (user_id, vacancy_id) FK makes it structurally impossible to link a manual
//      event to ANOTHER user's vacancy — not just "the repo happens not to do that".
//   3. Deleting the linked vacancy cascades and removes the calendar event with it.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";
import { calendarEvents } from "../../db/schema/index.js";

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
  stack: [] as string[],
};

const NEW_EVENT = {
  title: "On-site interview",
  notes: "Bring laptop",
  startAt: "2026-08-10T14:00:00.000Z",
  endAt: null as string | null,
  type: "interview",
  vacancyId: null as number | null,
  contactId: null as number | null,
};

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./calendar.repo.js");
let vacanciesRepo: typeof import("../vacancies/vacancies.repo.js");

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./calendar.repo.js");
  vacanciesRepo = await import("../vacancies/vacancies.repo.js");
});

describe("calendar.repo (PGlite)", () => {
  it("createCalendarEvent() + listCalendarEvents() round-trips a manual event", async () => {
    const event = await repo.createCalendarEvent(USER_A, NEW_EVENT);
    expect(event).toEqual(expect.objectContaining({ title: "On-site interview", type: "interview" }));
    const rows = await repo.listCalendarEvents(USER_A);
    expect(rows.some((r) => r.id === event.id)).toBe(true);
  });

  it("listCalendarEvents() never returns another user's rows", async () => {
    const eventB = await repo.createCalendarEvent(USER_B, { ...NEW_EVENT, title: "User B's event" });
    const rowsA = await repo.listCalendarEvents(USER_A);
    const rowsB = await repo.listCalendarEvents(USER_B);
    expect(rowsA.some((r) => r.id === eventB.id)).toBe(false);
    expect(rowsB.every((r) => r.title === "User B's event")).toBe(true);
  });

  it("getCalendarEvent() returns undefined when the id belongs to a different user (not a leak, not a crash)", async () => {
    const eventA = await repo.createCalendarEvent(USER_A, NEW_EVENT);
    expect(await repo.getCalendarEvent(USER_B, eventA.id)).toBeUndefined();
  });

  it("deleteCalendarEvent() scoped to the wrong user deletes nothing", async () => {
    const eventA = await repo.createCalendarEvent(USER_A, NEW_EVENT);
    const deletedByB = await repo.deleteCalendarEvent(USER_B, eventA.id);
    expect(deletedByB).toBe(0);
    expect(await repo.getCalendarEvent(USER_A, eventA.id)).toBeDefined();
  });

  it("listCalendarEvents() filters by date range (inclusive)", async () => {
    await repo.createCalendarEvent(USER_A, { ...NEW_EVENT, title: "In Jan", startAt: "2027-01-15T00:00:00.000Z" });
    await repo.createCalendarEvent(USER_A, { ...NEW_EVENT, title: "In Feb", startAt: "2027-02-15T00:00:00.000Z" });
    const rows = await repo.listCalendarEvents(USER_A, { from: "2027-01-01T00:00:00.000Z", to: "2027-01-31T23:59:59.999Z" });
    expect(rows.map((r) => r.title)).toContain("In Jan");
    expect(rows.map((r) => r.title)).not.toContain("In Feb");
  });

  it("can link a manual event to the caller's own vacancy", async () => {
    const vacancyId = await vacanciesRepo.createVacancy(USER_A, NEW_VACANCY);
    const event = await repo.createCalendarEvent(USER_A, { ...NEW_EVENT, vacancyId });
    expect(event.vacancyId).toBe(vacancyId);
  });

  it("the composite FK rejects linking an event to ANOTHER user's vacancy at the SQL level", async () => {
    const vacancyIdOfA = await vacanciesRepo.createVacancy(USER_A, NEW_VACANCY);
    // Bypasses the repo/route-level ownership check on purpose — this proves the DB schema
    // itself (not just application code) makes this cross-tenant link impossible.
    await expect(
      testDb
        .insert(calendarEvents)
        .values({ userId: USER_B, title: "Cross-tenant attempt", startAt: NEW_EVENT.startAt, vacancyId: vacancyIdOfA }),
    ).rejects.toThrow();
  });

  it("deleting the linked vacancy cascades and removes the calendar event with it", async () => {
    const vacancyId = await vacanciesRepo.createVacancy(USER_A, NEW_VACANCY);
    const event = await repo.createCalendarEvent(USER_A, { ...NEW_EVENT, vacancyId });
    await vacanciesRepo.deleteVacancy(USER_A, vacancyId);
    expect(await repo.getCalendarEvent(USER_A, event.id)).toBeUndefined();
  });
});
