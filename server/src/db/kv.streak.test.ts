// Integration test against a REAL (in-process, PGlite) Postgres for the study-streak helpers —
// getStudyStreak()/recordStudyActivity() live in kv.ts alongside the rest of the per-user KV
// domain helpers, see companies.repo.test.ts/vacancies.repo.test.ts for the same pattern.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "./test-db.js";
import { BOOTSTRAP_USER_ID } from "./user-id.js";

const USER_A = BOOTSTRAP_USER_ID;

let kv: typeof import("./kv.js");

beforeAll(async () => {
  const testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  vi.doMock("./client.js", () => ({ default: testDb }));
  kv = await import("./kv.js");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("study streak (PGlite)", () => {
  it("starts a fresh streak at 1 for a user with no prior activity", async () => {
    const state = await kv.recordStudyActivity(USER_A);
    expect(state).toEqual({ current: 1, longest: 1, lastActiveDate: expect.any(String) });
  });

  it("is a no-op when called again the same day (grading 10 cards in a row counts once)", async () => {
    const first = await kv.recordStudyActivity(USER_A);
    const second = await kv.recordStudyActivity(USER_A);
    expect(second).toEqual(first);
  });

  it("advances the streak by one when the last active day was yesterday", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
    await kv.recordStudyActivity(USER_A);

    vi.setSystemTime(new Date("2026-01-11T09:00:00.000Z"));
    const state = await kv.recordStudyActivity(USER_A);

    expect(state).toEqual({ current: 2, longest: 2, lastActiveDate: "2026-01-11" });
  });

  it("resets to 1 after a gap of more than one day, but keeps the longest streak on record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T12:00:00.000Z"));
    await kv.recordStudyActivity(USER_A);
    vi.setSystemTime(new Date("2026-02-02T12:00:00.000Z"));
    const twoDayStreak = await kv.recordStudyActivity(USER_A);
    expect(twoDayStreak.current).toBe(2);

    // Skip a day entirely — the streak breaks, but the longest streak achieved isn't forgotten.
    vi.setSystemTime(new Date("2026-02-04T12:00:00.000Z"));
    const afterGap = await kv.recordStudyActivity(USER_A);

    expect(afterGap.current).toBe(1);
    expect(afterGap.longest).toBe(2);
  });

  it("getStudyStreak() returns a zeroed state for a user who never studied", async () => {
    const other = "other-streak-user" as typeof USER_A;
    const testDb = await createTestDb();
    await insertTestUser(testDb, other);
    vi.doMock("./client.js", () => ({ default: testDb }));
    vi.resetModules();
    const freshKv: typeof import("./kv.js") = await import("./kv.js");
    expect(await freshKv.getStudyStreak(other)).toEqual({ current: 0, longest: 0, lastActiveDate: "" });
  });
});
