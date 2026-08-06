// Two independent lookups: token -> userId (one-time, dedicated table — see db/schema/telegram.ts
// for why) and userId -> chatId (naturally user-keyed, so it lives in the generic user_kv store
// via db/kv.ts's getKvJson/setKvJson, same as the onboarding.welcomeSeen flag).
import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import db from "../../db/client.js";
import { telegramLinkTokens } from "../../db/schema/index.js";
import { getKvJson, setKvJson } from "../../db/kv.js";
import type { UserId } from "../../db/user-id.js";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const CHAT_ID_KEY = "telegram.chatId";

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

// Wrapped in an object rather than stored as a bare string: a Telegram chat id is always
// numeric-LOOKING text (e.g. "111"), and a bare JSON-jsonb string that happens to be valid JSON
// on its own gets stored/read back as the JSON NUMBER 111, not the string "111" — silently
// turning `getTelegramChatId` into a `string | number`. An object always round-trips correctly.
interface ChatIdValue {
  chatId: string | null;
}

export async function getTelegramChatId(userId: UserId): Promise<string | null> {
  return (await getKvJson<ChatIdValue>(userId, CHAT_ID_KEY))?.chatId ?? null;
}

export async function setTelegramChatId(userId: UserId, chatId: string): Promise<void> {
  await setKvJson(userId, CHAT_ID_KEY, { chatId });
}

export async function clearTelegramChatId(userId: UserId): Promise<void> {
  // { chatId: null }, not a bare null — user_kv.v has a NOT NULL constraint at the DB level, and
  // setKvJson passes a top-level JS `null` through as an actual SQL NULL, not a JSON null literal.
  await setKvJson(userId, CHAT_ID_KEY, { chatId: null });
}
