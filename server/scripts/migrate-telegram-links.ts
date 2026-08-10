// One-time backfill for the Telegram link's move out of user_kv: every account that linked a chat
// under the old storage (user_kv, keyed "telegram.chatId", holding `{ chatId }`) gets a real
// `telegram_links` row. The move is what makes an INCOMING message usable — the webhook only
// carries a chat id, and answering "whose account is this?" needs the reverse lookup a user-keyed
// KV row can't do (see db/schema/telegram.ts#telegramLinks).
//
// Schema migration 0018 (drizzle/0018_large_shard.sql) creates the empty table — this script is
// the other half of it, run once after 0018 is applied. Without it, already-linked users silently
// stop receiving notifications (the app reads the new table only) until they re-link by hand.
//
// Safe to re-run: rows already present in telegram_links are skipped, and unlinked accounts
// (`{ chatId: null }`, what the old clearTelegramChatId wrote) are ignored. The legacy user_kv
// rows are deliberately left in place — dropping them is a separate, reversible-by-nobody step,
// and they're inert once nothing reads that key.
//
// Usage: npx tsx server/scripts/migrate-telegram-links.ts [--dry-run]
import "dotenv/config";
import { eq } from "drizzle-orm";
import db from "../src/db/client.js";
import { telegramLinks, userKv } from "../src/db/schema/index.js";
import type { UserId } from "../src/db/user-id.js";

const dryRun = process.argv.includes("--dry-run");

const legacyRows = await db.select().from(userKv).where(eq(userKv.k, "telegram.chatId"));
console.log(`Found ${legacyRows.length} legacy "telegram.chatId" row(s) in user_kv.`);

let migrated = 0;
let skippedUnlinked = 0;
let skippedExisting = 0;

for (const row of legacyRows) {
  const userId = row.userId as UserId;
  // The value was always stored wrapped in an object, never as a bare string — a bare JSON string
  // that happens to be numeric ("111") round-trips back out of jsonb as the NUMBER 111. Hence the
  // String() below rather than trusting the stored type.
  const chatId = (row.v as { chatId?: string | number | null } | null)?.chatId;
  if (chatId === null || chatId === undefined || chatId === "") {
    skippedUnlinked++;
    continue;
  }
  const [existing] = await db.select({ userId: telegramLinks.userId }).from(telegramLinks).where(eq(telegramLinks.userId, userId));
  if (existing) {
    skippedExisting++;
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] would link user ${userId} -> chat ${String(chatId)}`);
    migrated++;
    continue;
  }
  // onConflictDoNothing on the chat_id PK too: the same chat can't legitimately belong to two
  // accounts, and a duplicate here should be skipped rather than abort the whole backfill.
  const inserted = await db
    .insert(telegramLinks)
    .values({ chatId: String(chatId), userId })
    .onConflictDoNothing()
    .returning({ chatId: telegramLinks.chatId });
  if (inserted.length > 0) migrated++;
  else skippedExisting++;
}

console.log(
  dryRun
    ? `[dry-run] ${migrated} link(s) would be migrated, ${skippedExisting} already present, ${skippedUnlinked} unlinked.`
    : `Migrated ${migrated} link(s), ${skippedExisting} already present, ${skippedUnlinked} unlinked.`,
);
process.exit(0);
