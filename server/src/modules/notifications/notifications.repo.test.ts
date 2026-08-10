// Integration test against a REAL (in-process, PGlite) Postgres. The dedupe ledger's whole value
// is that its check-and-mark is ONE atomic statement — that's a claim about SQL semantics
// (ON CONFLICT ... DO UPDATE ... WHERE), so mocking it away would test nothing.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "notif-user-b" as UserId;

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./notifications.repo.js");

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./notifications.repo.js");
});

describe("claimNotification() (PGlite)", () => {
  it("grants the first claim and refuses every repeat, by default forever", async () => {
    expect(await repo.claimNotification(USER_A, "interview:1:24h")).toBe(true);
    expect(await repo.claimNotification(USER_A, "interview:1:24h")).toBe(false);
    expect(await repo.claimNotification(USER_A, "interview:1:24h")).toBe(false);
  });

  it("scopes claims per user — one user's reminder never suppresses another's", async () => {
    expect(await repo.claimNotification(USER_A, "shared-key")).toBe(true);
    expect(await repo.claimNotification(USER_B, "shared-key")).toBe(true);
  });

  it("treats different keys independently", async () => {
    expect(await repo.claimNotification(USER_A, "interview:2:24h")).toBe(true);
    expect(await repo.claimNotification(USER_A, "interview:2:1h")).toBe(true);
  });

  it("re-arms once a finite TTL has elapsed (the debounce case)", async () => {
    expect(await repo.claimNotification(USER_A, "cvView:abc", 5)).toBe(true);
    // A real elapsed interval, not a TTL of 0: the comparison is a strict `<`, so at exactly the
    // boundary the row is not yet stale. Waiting past the TTL is what the debounce actually does.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await repo.claimNotification(USER_A, "cvView:abc", 5)).toBe(true);
  });

  it("still refuses inside a TTL that hasn't elapsed", async () => {
    expect(await repo.claimNotification(USER_A, "cvView:def", 60_000)).toBe(true);
    expect(await repo.claimNotification(USER_A, "cvView:def", 60_000)).toBe(false);
  });

  it("a permanent claim blocks a later TTL'd claim on the same key", async () => {
    expect(await repo.claimNotification(USER_A, "mixed-key")).toBe(true);
    expect(await repo.claimNotification(USER_A, "mixed-key", 60_000)).toBe(false);
  });
});

describe("sweepNotificationLedger() (PGlite)", () => {
  it("leaves fresh rows alone", async () => {
    await repo.claimNotification(USER_B, "fresh-key");
    await repo.sweepNotificationLedger(60_000);
    // Still claimed, so the sweep did not resurrect it.
    expect(await repo.claimNotification(USER_B, "fresh-key")).toBe(false);
  });

  it("drops rows older than the retention window, freeing the key again", async () => {
    await repo.claimNotification(USER_B, "old-key");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const deleted = await repo.sweepNotificationLedger(5);
    expect(deleted).toBeGreaterThan(0);
    // Sweeping a spent key is what makes it claimable again — safe only because every key this app
    // writes is tied to something that has stopped mattering long before the real retention window.
    expect(await repo.claimNotification(USER_B, "old-key")).toBe(true);
  });
});

describe("notification settings (PGlite)", () => {
  it("defaults to empty prefs and no timezone for a user with no row", async () => {
    const userId = "notif-no-row" as UserId;
    await insertTestUser(testDb, userId);
    expect(await repo.getNotificationSettings(userId)).toEqual({ prefs: {}, timezone: null });
  });

  // The row is shared with the weekly digest, so saving notification prefs must CREATE it for a
  // user who never touched the digest toggle — an UPDATE would silently no-op for most users.
  it("upserts a row for a user who never touched the digest toggle", async () => {
    const userId = "notif-upsert" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setNotificationSettings(userId, { prefs: { stale: false }, timezone: "Europe/Kyiv" });
    expect(await repo.getNotificationSettings(userId)).toEqual({ prefs: { stale: false }, timezone: "Europe/Kyiv" });
  });

  it("never turns the weekly digest on as a side effect of saving notification prefs", async () => {
    const userId = "notif-no-digest-flip" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setNotificationSettings(userId, { prefs: {}, timezone: "UTC" });
    const digestRepo = await import("../digest/digest.repo.js");
    expect((await digestRepo.getDigestPreferences(userId)).enabled).toBe(false);
  });

  it("setUserTimezone() leaves existing prefs untouched", async () => {
    const userId = "notif-tz-only" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setNotificationSettings(userId, { prefs: { streak: false }, timezone: null });
    await repo.setUserTimezone(userId, "America/New_York");
    expect(await repo.getNotificationSettings(userId)).toEqual({ prefs: { streak: false }, timezone: "America/New_York" });
  });
});

describe("listNotifiableUsers() (PGlite)", () => {
  it("returns only users with a linked chat, carrying their prefs and zone", async () => {
    const linked = "notif-linked" as UserId;
    const unlinked = "notif-unlinked" as UserId;
    await insertTestUser(testDb, linked);
    await insertTestUser(testDb, unlinked);
    const telegramRepo = await import("../telegram/telegram.repo.js");
    await telegramRepo.setTelegramChatId(linked, "chat-notifiable");
    await repo.setNotificationSettings(linked, { prefs: { digest: false }, timezone: "Europe/Kyiv" });

    const rows = await repo.listNotifiableUsers();
    const row = rows.find((r) => r.userId === linked);
    expect(row).toMatchObject({ chatId: "chat-notifiable", prefs: { digest: false }, timezone: "Europe/Kyiv" });
    expect(rows.some((r) => r.userId === unlinked)).toBe(false);
  });

  // The LEFT JOIN case: most linked users never open the settings panel, so they have no
  // digest_preferences row at all and must still come back with usable defaults.
  it("includes a linked user with no preferences row, defaulting prefs to empty", async () => {
    const userId = "notif-linked-no-prefs" as UserId;
    await insertTestUser(testDb, userId);
    const telegramRepo = await import("../telegram/telegram.repo.js");
    await telegramRepo.setTelegramChatId(userId, "chat-no-prefs");
    const row = (await repo.listNotifiableUsers()).find((r) => r.userId === userId);
    expect(row).toMatchObject({ chatId: "chat-no-prefs", prefs: {}, timezone: null });
  });
});
