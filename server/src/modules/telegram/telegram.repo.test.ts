// Integration test against a REAL (in-process, PGlite) Postgres — proves the token->userId
// reverse lookup is one-time-use, expiry actually works at the SQL level, and chat id storage
// stays scoped per user.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, insertTestUser } from "../../db/test-db.js";
import { BOOTSTRAP_USER_ID, type UserId } from "../../db/user-id.js";

const USER_A = BOOTSTRAP_USER_ID;
const USER_B = "user-b" as UserId;

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./telegram.repo.js");

beforeAll(async () => {
  testDb = await createTestDb();
  await insertTestUser(testDb, USER_A);
  await insertTestUser(testDb, USER_B);
  vi.doMock("../../db/client.js", () => ({ default: testDb }));
  repo = await import("./telegram.repo.js");
});

describe("createLinkToken() / resolveLinkToken() (PGlite)", () => {
  it("resolves a freshly created token to the user that created it", async () => {
    const token = await repo.createLinkToken(USER_A);
    expect(await repo.resolveLinkToken(token)).toBe(USER_A);
  });

  it("is one-time use — resolving the same token a second time returns null", async () => {
    const token = await repo.createLinkToken(USER_A);
    expect(await repo.resolveLinkToken(token)).toBe(USER_A);
    expect(await repo.resolveLinkToken(token)).toBeNull();
  });

  it("returns null for a token that was never created", async () => {
    expect(await repo.resolveLinkToken("never-existed")).toBeNull();
  });

  it("expired tokens resolve to null and are swept on the next lookup", async () => {
    const token = await repo.createLinkToken(USER_B);
    const schema = await import("../../db/schema/index.js");
    const { eq } = await import("drizzle-orm");
    const testDbModule = await import("../../db/client.js");
    await testDbModule.default
      .update(schema.telegramLinkTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.telegramLinkTokens.token, token));
    expect(await repo.resolveLinkToken(token)).toBeNull();
  });
});

describe("chat id storage (PGlite)", () => {
  it("defaults to null (unlinked) for a user who has never linked", async () => {
    const userId = "user-never-linked" as UserId;
    expect(await repo.getTelegramChatId(userId)).toBeNull();
  });

  it("setTelegramChatId()/getTelegramChatId() round-trip, scoped per user", async () => {
    const userA = "user-chat-a" as UserId;
    const userB = "user-chat-b" as UserId;
    await insertTestUser(testDb, userA);
    await insertTestUser(testDb, userB);
    await repo.setTelegramChatId(userA, "111");
    await repo.setTelegramChatId(userB, "222");
    expect(await repo.getTelegramChatId(userA)).toBe("111");
    expect(await repo.getTelegramChatId(userB)).toBe("222");
  });

  it("clearTelegramChatId() unlinks the account", async () => {
    const userId = "user-to-unlink" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setTelegramChatId(userId, "333");
    expect(await repo.getTelegramChatId(userId)).toBe("333");
    await repo.clearTelegramChatId(userId);
    expect(await repo.getTelegramChatId(userId)).toBeNull();
  });
});
