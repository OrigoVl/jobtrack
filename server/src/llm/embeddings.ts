// Vector embeddings (OpenAI `text-embedding-3-small`) for SEMANTIC similarity between CV↔vacancy —
// a complement to the exact/fuzzy tech dictionary (tech-dict.ts): the dictionary catches KEYWORD
// MATCHES ("React", "Docker"), embeddings catch semantic closeness even without any shared
// dictionary term (e.g. "built a REST API on Node.js" and "backend developer with experience
// building scalable services" — semantically close, no shared tech terms).
//
// Cheaper and faster than an LLM chat call for comparison: the text embedding is computed ONCE and
// cached (every subsequent request with the same text — 0 additional API calls), and
// comparing two texts is just the cosine similarity of two number arrays (milliseconds,
// no network), not a separate LLM call for every CV+vacancy pair.
//
// Available only for the OpenAI provider — Anthropic has no public embeddings API in this
// app. If the provider is anthropic or there's no key, embeddingsAvailable() === false and
// semanticSimilarity/embed quietly return null (graceful — the same approach as chat()'s
// llmAvailable()) — the caller (quickAnalyze) treats null as "no signal", not as "0%".
import { getKvJson, setKvJson } from "../db/index.js";
import { contextLogger } from "../core/logger.js";
import { hashString } from "../shared/hash.js";
import { env } from "../config/env.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
// The same time budget as the "fast" tier of chat requests (llm/client.ts) — a short text
// embedding shouldn't wait longer than a fast LLM extraction.
const TIMEOUT_MS = env.llm.timeoutMsFast;
// The same limit used for CVs/vacancies in prompts across the app (llm/client.ts,
// writing.routes.ts, etc.) — cheap and predictable in terms of input tokens.
const MAX_INPUT_CHARS = 8000;

export function embeddingsAvailable(): boolean {
  return env.llm.provider === "openai" && !!env.llm.openaiApiKey;
}

/**
 * Embeds text, or returns null if the provider is unavailable/the input is empty/the API call fails —
 * NEVER throws (graceful, like chat()). Cached by a hash of text+model in the kv store:
 * the same CV/vacancy doesn't pay for an API call again.
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!embeddingsAvailable()) return null;
  const input = text.slice(0, MAX_INPUT_CHARS).trim();
  if (!input) return null;
  const cacheKey = "embedding:" + hashString([EMBEDDING_MODEL, input].join("|"));
  const cached = getKvJson<{ vector: number[] }>(cacheKey);
  if (cached) return cached.vector;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${env.llm.openaiApiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      contextLogger().error({ status: r.status, body: body.slice(0, 500), model: EMBEDDING_MODEL }, "Embeddings API error response");
      return null;
    }
    const d = (await r.json()) as { data?: { embedding?: number[] }[] };
    const vector = d?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || !vector.length) return null;
    setKvJson(cacheKey, { vector });
    return vector;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    contextLogger().error({ err: e, model: EMBEDDING_MODEL }, timedOut ? "Embeddings request timeout" : "Embeddings request error");
    return null;
  }
}

/** Cosine similarity of two vectors of equal length: 1 = same direction, 0 = orthogonal. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Semantic similarity of two texts in the [0,1] range (cosine similarity of OpenAI
 * embeddings for natural language is practically always non-negative — the clamp is just a safeguard).
 * null — embeddings are unavailable, or the API request failed for either text.
 */
export async function semanticSimilarity(textA: string, textB: string): Promise<number | null> {
  const [vecA, vecB] = await Promise.all([embed(textA), embed(textB)]);
  if (!vecA || !vecB) return null;
  return Math.max(0, Math.min(1, cosineSimilarity(vecA, vecB)));
}
