// Cache for third-party contact-enrichment lookups (Hunter.io/Apollo.io/Snov.io) — mirrors
// db/llm-cache.ts almost exactly (global, hash-keyed, a row past TTL is treated as a miss,
// createdAt reset on re-cache) but against its OWN table (enrichment_cache, not llm_cache) with a
// much shorter TTL. See db/schema/app.ts#enrichmentCache for why this is a separate table.
import { and, eq, gt } from "drizzle-orm";
import db from "./client.js";
import { enrichmentCache } from "./schema/index.js";

// Shorter than llm_cache's 90 days: this table holds third-party PERSONAL data (recruiter
// names/emails), and recruiters change jobs — GDPR storage-limitation principles argue against
// holding it indefinitely.
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function getEnrichmentCache<T = unknown>(key: string): Promise<T | null> {
  const notExpired = new Date(Date.now() - TTL_MS);
  const [row] = await db
    .select({ v: enrichmentCache.v })
    .from(enrichmentCache)
    .where(and(eq(enrichmentCache.k, key), gt(enrichmentCache.createdAt, notExpired)));
  return row ? (row.v as T) : null;
}

export async function setEnrichmentCache(key: string, value: unknown): Promise<void> {
  await db
    .insert(enrichmentCache)
    .values({ k: key, v: value })
    // createdAt reset on conflict too — same reasoning as llm-cache.ts's setLlmCache: without it,
    // a key that already expired once would keep failing the TTL check above forever.
    .onConflictDoUpdate({ target: enrichmentCache.k, set: { v: value, createdAt: new Date() } });
}
