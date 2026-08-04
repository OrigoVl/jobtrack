// Global (NOT per-user) cache for the 4 LLM/embeddings/skill-extraction call sites keyed on a
// hash of the FULL input text (prompt/CV/vacancy text) — see db/schema/app.ts#llmCache for why
// that specific shape of cache key is safe to share across tenants (a cache hit requires a
// byte-identical input), unlike a cache keyed on a DERIVED attribute (e.g. knowledge.service.ts's
// `kb:` cache, which stays in the per-user user_kv table for exactly that reason).
import { and, eq, gt } from "drizzle-orm";
import db from "./client.js";
import { llmCache } from "./schema/index.js";

// llm/client.ts's cache key deliberately omits the specific model (only the tier) so an .env
// model swap within a tier doesn't invalidate the cache — but without SOME expiry, a response
// from a since-superseded model would otherwise be served for the same input forever. A row past
// this age is treated as a miss (see the `gt` below, backed by llm_cache_created_at_idx).
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export async function getLlmCache<T = unknown>(key: string): Promise<T | null> {
  const notExpired = new Date(Date.now() - TTL_MS);
  const [row] = await db
    .select({ v: llmCache.v })
    .from(llmCache)
    .where(and(eq(llmCache.k, key), gt(llmCache.createdAt, notExpired)));
  return row ? (row.v as T) : null;
}

export async function setLlmCache(key: string, value: unknown): Promise<void> {
  await db
    .insert(llmCache)
    .values({ k: key, v: value })
    // createdAt reset on conflict too: without it, a key that already expired once would keep
    // failing the TTL check above forever (its createdAt would stay stuck in the past), forcing
    // a real LLM call on every single request instead of caching the freshly-regenerated value.
    .onConflictDoUpdate({ target: llmCache.k, set: { v: value, createdAt: new Date() } });
}
