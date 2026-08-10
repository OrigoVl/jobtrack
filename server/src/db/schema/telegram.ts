// One-time link tokens for connecting a Telegram chat to an account (modules/telegram/). A
// dedicated table, not user_kv: the whole point is a REVERSE lookup (token -> userId) when the
// webhook receives a `/start <token>` message, which a user-keyed KV store can't do without
// scanning every user. The resulting chat id itself IS naturally user-keyed (send a message to
// THIS user), so that half lives in user_kv (modules/telegram/telegram.repo.ts) instead.
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

const userIdCol = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const telegramLinkTokens = pgTable("telegram_link_tokens", {
  token: text().primaryKey(),
  userId: userIdCol(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// The established link itself. This USED to be a `user_kv` row ("telegram.chatId"), which was the
// right call while the bot only ever pushed messages out — that direction is naturally user-keyed
// ("send to THIS user"). It stops being right the moment the bot accepts INPUT: an incoming
// `/add <url>` or a tapped inline button arrives carrying only a chat id, and answering "whose
// account is this?" from a user-keyed KV store means scanning every user. So this is now a real
// table for the same reason telegramLinkTokens above already is — a reverse lookup — with chat_id
// as the PK because that IS the incoming webhook's identifier.
//
// UNIQUE on user_id keeps the old one-chat-per-account semantics the KV row had implicitly:
// re-linking from a second chat moves the link rather than fanning out to both (see
// telegram.repo.ts#setTelegramChatId's upsert-on-user_id).
//
// The notifications scheduler also full-table-scans this (notifications.repo.ts#listLinkedUsers) —
// a legitimate global query like saved-searches.repo.ts#listAllSavedSearches, and a naturally tiny
// scan since only users who actually linked a chat have a row at all.
export const telegramLinks = pgTable(
  "telegram_links",
  {
    chatId: text("chat_id").primaryKey(),
    userId: userIdCol(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("telegram_links_user_id_key").on(t.userId)],
);
