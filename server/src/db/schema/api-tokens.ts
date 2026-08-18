// Personal API tokens for MCP (Model Context Protocol) clients to authenticate as bearer tokens
// instead of a browser session (see modules/mcp/ once it lands). A real table, not a `user_kv`
// row: resolving an inbound bearer token to its owner is a REVERSE lookup (token hash -> userId)
// on every authenticated request, which `user_kv`'s (userId, k) primary key can't serve without
// scanning every user — same reasoning as telegram.ts's telegramLinkTokens/telegramLinks.
//
// `tokenHash` stores a SHA-256 hash of the token, never the raw value — the raw token is shown to
// the user exactly once at creation time and is not retrievable afterwards.
//
// `revokedAt` is a soft-delete: revoking a token sets this timestamp rather than deleting the row,
// so a revoked token's history (when it was created, when it was last used, why an old integration
// stopped working) stays auditable instead of disappearing.
import { pgTable, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

const userIdCol = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    tokenHash: text("token_hash").notNull(),
    label: text().notNull().default(""),
    scope: text().notNull().default("read"), // "read" | "read_write" — app-level union, text column (matches vacancies.status/calendar_events.type convention)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("api_tokens_token_hash_key").on(t.tokenHash), index("api_tokens_user_id_idx").on(t.userId, t.createdAt)],
);
