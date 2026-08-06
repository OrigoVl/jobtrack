// One-time link tokens for connecting a Telegram chat to an account (modules/telegram/). A
// dedicated table, not user_kv: the whole point is a REVERSE lookup (token -> userId) when the
// webhook receives a `/start <token>` message, which a user-keyed KV store can't do without
// scanning every user. The resulting chat id itself IS naturally user-keyed (send a message to
// THIS user), so that half lives in user_kv (modules/telegram/telegram.repo.ts) instead.
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
