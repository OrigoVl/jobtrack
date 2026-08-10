// Two lookups over two dedicated tables (db/schema/telegram.ts): token -> userId (one-time, for
// the /start deep link) and chat id <-> userId (the established link).
//
// The chat id used to live in the generic `user_kv` store, which was right while the bot only
// pushed messages OUT. It moved to its own table once the bot started accepting input: an incoming
// `/add <url>` or a tapped button arrives carrying only a chat id, and resolving that to an account
// against a user-keyed KV store means scanning every user. server/scripts/migrate-telegram-links.ts
// is the one-off backfill that carries the old rows over.
import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import db from "../../db/client.js";
import { telegramLinkTokens, telegramLinks } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export async function createLinkToken(userId: UserId): Promise<string> {
  const token = randomBytes(16).toString("base64url");
  await db.insert(telegramLinkTokens).values({ token, userId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });
  return token;
}

/** Also opportunistically deletes every already-expired token first — there's no cron/worker in
 * this app for background housekeeping (see the digest/saved-searches schedulers' own "just
 * setInterval, no queue" reasoning), and this table only grows by one row per link ATTEMPT, so a
 * lazy sweep on the one code path that actually reads it is enough to keep it from growing
 * unbounded. One-time use: the matched row is deleted immediately after being read, so a token
 * can never link two different chats. */
export async function resolveLinkToken(token: string): Promise<UserId | null> {
  await db.delete(telegramLinkTokens).where(lt(telegramLinkTokens.expiresAt, new Date()));
  const [row] = await db.select({ userId: telegramLinkTokens.userId }).from(telegramLinkTokens).where(eq(telegramLinkTokens.token, token));
  if (!row) return null;
  await db.delete(telegramLinkTokens).where(eq(telegramLinkTokens.token, token));
  return row.userId as UserId;
}

export async function getTelegramChatId(userId: UserId): Promise<string | null> {
  const [row] = await db.select({ chatId: telegramLinks.chatId }).from(telegramLinks).where(eq(telegramLinks.userId, userId));
  return row?.chatId ?? null;
}

/** The reverse direction — the one the incoming webhook needs, and the only reason this is a table
 * rather than a user_kv row. Returns null for a chat that was never linked (or has since been
 * unlinked), which is exactly how the webhook decides an incoming command is unauthenticated. */
export async function getUserIdByChatId(chatId: string): Promise<UserId | null> {
  const [row] = await db.select({ userId: telegramLinks.userId }).from(telegramLinks).where(eq(telegramLinks.chatId, chatId));
  return (row?.userId as UserId) ?? null;
}

/** Links a chat, replacing whatever this account was linked to before. Two conflict targets are
 * genuinely possible and mean different things, so this can't be a single upsert: `chat_id` (the
 * PK — this chat already belongs to some account) and `user_id` (the unique index — this account
 * already has a different chat). Deleting both candidate rows first collapses that to a plain
 * insert, inside a transaction so a concurrent /start can't interleave between the two. */
export async function setTelegramChatId(userId: UserId, chatId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
    await tx.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
    await tx.insert(telegramLinks).values({ chatId, userId });
  });
}

export async function clearTelegramChatId(userId: UserId): Promise<void> {
  await db.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
}

/** Drops a link by chat id rather than user id — for the one caller that only has the chat: the
 * dead-chat cleanup in shared/notify.ts, reacting to a `blocked` send result. */
export async function clearTelegramChat(chatId: string): Promise<void> {
  await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
}
