// A single hash function for cache keys (LLM responses, personal knowledge base, skill/domain
// extraction). Not for secrecy (these keys are never meant to be secret) — SHA-256, not the
// original djb2, specifically to make a COLLISION (two different inputs producing the same
// cache key) practically impossible. djb2's 32-bit output made a collision plausible at scale
// (~77k entries for a 50% chance, the birthday bound), and 4 of these 5 caches are deliberately
// GLOBAL, shared across all tenants (see db/llm-cache.ts) — a collision there would mean one
// user's request silently returns a response generated from a DIFFERENT user's input text, a
// real cross-tenant data leak, not just a cache-correctness bug.
import { createHash } from "node:crypto";

export function hashString(str: string): string {
  return createHash("sha256").update(str, "utf8").digest("hex");
}
