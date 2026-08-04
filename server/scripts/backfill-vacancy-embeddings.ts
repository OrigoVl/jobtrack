// One-time backfill: computes and stores an embedding (llm/embeddings.ts) for every existing
// vacancy that doesn't have one yet — new vacancies get this automatically on save (see
// vacancies.routes.ts's embedVacancyInBackground), but rows created before that shipped need a
// manual pass. Skips vacancies with no meaningful text (vacancy-text.ts#vacancyEmbeddingText
// returns "") — nothing useful to embed.
//
// Unlike its sibling scripts in this folder (plain .mjs + a raw `pg` client, no app code
// imports), this one deliberately imports the app's own TypeScript (llm/embeddings.ts,
// vacancy-text.ts, db/schema) so the computed vectors use the exact same model/caching/telemetry
// path a live save would — duplicating that logic in raw JS here would just create a second,
// divergent copy of "how do we embed a vacancy" to keep in sync by hand.
//
// Usage: npx tsx server/scripts/backfill-vacancy-embeddings.ts [--dry-run]
import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import db from "../src/db/client.js";
import { vacancies } from "../src/db/schema/index.js";
import { embed, embeddingsAvailable } from "../src/llm/embeddings.js";
import { vacancyEmbeddingText } from "../src/modules/vacancies/vacancy-text.js";
import type { UserId } from "../src/db/user-id.js";

const dryRun = process.argv.includes("--dry-run");

if (!embeddingsAvailable()) {
  console.error("❌ Embeddings unavailable — set LLM_PROVIDER=openai and OPENAI_API_KEY in server/.env first.");
  process.exit(1);
}

const rows = await db
  .select({
    id: vacancies.id,
    userId: vacancies.userId,
    company: vacancies.company,
    position: vacancies.position,
    level: vacancies.level,
    stack: vacancies.stack,
    notes: vacancies.notes,
  })
  .from(vacancies)
  .where(isNull(vacancies.embedding));

console.log(`Found ${rows.length} vacancy(ies) without an embedding.`);

let embedded = 0;
let skippedEmpty = 0;
let failed = 0;

for (const row of rows) {
  const text = vacancyEmbeddingText(row);
  if (!text) {
    skippedEmpty++;
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] would embed vacancy #${row.id} (${row.company || "?"} — ${row.position || "?"})`);
    embedded++;
    continue;
  }
  const vector = await embed(row.userId as UserId, text, "vacancy-embedding-backfill");
  if (!vector) {
    failed++;
    console.warn(`⚠️  Failed to embed vacancy #${row.id} (${row.company || "?"}) — leaving it for a future retry.`);
    continue;
  }
  await db.update(vacancies).set({ embedding: vector }).where(eq(vacancies.id, row.id));
  embedded++;
}

console.log(`\n✅ Done. Embedded: ${embedded}, skipped (no text): ${skippedEmpty}, failed: ${failed}.`);
process.exit(0);
