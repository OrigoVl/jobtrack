// Global (NOT per-user) cache for the 4 LLM/embeddings/skill-extraction call sites keyed on a
// hash of the FULL input text (prompt/CV/vacancy text) — see db/schema/app.ts#llmCache for why
// that specific shape of cache key is safe to share across tenants (a cache hit requires a
// byte-identical input), unlike a cache keyed on a DERIVED attribute (e.g. knowledge.service.ts's
// `kb:` cache, which stays in the per-user user_kv table for exactly that reason).
import { eq } from "drizzle-orm";
import db from "./client.js";
import { llmCache } from "./schema/index.js";

export async function getLlmCache<T = unknown>(key: string): Promise<T | null> {
  const [row] = await db.select({ v: llmCache.v }).from(llmCache).where(eq(llmCache.k, key));
  return row ? (row.v as T) : null;
}

export async function setLlmCache(key: string, value: unknown): Promise<void> {
  await db
    .insert(llmCache)
    .values({ k: key, v: value })
    .onConflictDoUpdate({ target: llmCache.k, set: { v: value } });
}
