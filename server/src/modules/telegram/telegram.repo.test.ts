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

  // A numeric-looking chat id must survive storage as the STRING it is. This used to be a real
  // hazard when the value lived in a jsonb user_kv blob (a bare "111" round-tripped back as the
  // NUMBER 111); it's a text column now, and this pins that.
  it("keeps a numeric-looking chat id a string", async () => {
    const userId = "user-numeric-chat" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setTelegramChatId(userId, "111");
    expect(await repo.getTelegramChatId(userId)).toBe("111");
  });
});

// The direction that only works because this is a real table — it's what lets the webhook turn an
// incoming message (which carries nothing but a chat id) into an account.
describe("getUserIdByChatId() (PGlite)", () => {
  it("resolves a linked chat back to its user", async () => {
    const userId = "user-reverse" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setTelegramChatId(userId, "chat-reverse");
    expect(await repo.getUserIdByChatId("chat-reverse")).toBe(userId);
  });

  // This is the bot's ONLY authentication (see telegram.commands.ts) — an unknown chat resolving
  // to anything but null would mean commands running against somebody's account.
  it("returns null for a chat that was never linked", async () => {
    expect(await repo.getUserIdByChatId("never-linked-chat")).toBeNull();
  });

  it("returns null once the account unlinks", async () => {
    const userId = "user-reverse-unlink" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setTelegramChatId(userId, "chat-goes-away");
    await repo.clearTelegramChatId(userId);
    expect(await repo.getUserIdByChatId("chat-goes-away")).toBeNull();
  });

  it("clearTelegramChat() drops the link given only the chat id (the blocked-bot cleanup path)", async () => {
    const userId = "user-blocked-bot" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setTelegramChatId(userId, "chat-blocked");
    await repo.clearTelegramChat("chat-blocked");
    expect(await repo.getTelegramChatId(userId)).toBeNull();
    expect(await repo.getUserIdByChatId("chat-blocked")).toBeNull();
  });
});

// Two different UNIQUE constraints can each be violated by a re-link, which is why
// setTelegramChatId deletes both candidate rows in a transaction rather than doing one upsert.
describe("re-linking (PGlite)", () => {
  it("moves the link when the same account links a second chat", async () => {
    const userId = "user-relink" as UserId;
    await insertTestUser(testDb, userId);
    await repo.setTelegramChatId(userId, "chat-old");
    await repo.setTelegramChatId(userId, "chat-new");
    expect(await repo.getTelegramChatId(userId)).toBe("chat-new");
    // The old chat must stop resolving, or a command sent from it would still act on the account.
    expect(await repo.getUserIdByChatId("chat-old")).toBeNull();
  });

  it("moves the link when the same chat is claimed by a different account", async () => {
    const first = "user-chat-owner-1" as UserId;
    const second = "user-chat-owner-2" as UserId;
    await insertTestUser(testDb, first);
    await insertTestUser(testDb, second);
    await repo.setTelegramChatId(first, "shared-chat");
    await repo.setTelegramChatId(second, "shared-chat");
    expect(await repo.getUserIdByChatId("shared-chat")).toBe(second);
    expect(await repo.getTelegramChatId(first)).toBeNull();
  });
});
