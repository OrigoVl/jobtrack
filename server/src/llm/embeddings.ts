// Векторні embeddings (OpenAI `text-embedding-3-small`) для СЕМАНТИЧНОЇ схожості CV↔вакансія —
// доповнення до точного/fuzzy tech-словника (tech-dict.ts): словник ловить ЗБІГИ КЛЮЧОВИХ СЛІВ
// ("React", "Docker"), embeddings ловлять смислову близькість навіть без жодного спільного
// терміну зі словника (напр. "будував REST API на Node.js" і "backend-розробник з досвідом
// побудови масштабованих сервісів" — семантично близькі, спільних tech-термінів немає).
//
// Дешевше й швидше за LLM chat-запит на порівняння: ембединг тексту рахується ОДИН раз і
// кешується (кожен наступний запит з тим самим текстом — 0 додаткових API-викликів), а
// порівняння двох текстів — це просто косинусна схожість двох масивів чисел (мілісекунди,
// без мережі), а не окремий LLM-виклик на кожну пару CV+вакансія.
//
// Доступно лише для OpenAI-провайдера — Anthropic не має публічного embeddings API в цьому
// застосунку. Якщо провайдер anthropic або немає ключа, embeddingsAvailable() === false і
// semanticSimilarity/embed тихо повертають null (graceful — той самий підхід, що й у chat()
// з llmAvailable()) — викликач (quickAnalyze) трактує null як "сигналу немає", не як "0%".
import { getKvJson, setKvJson } from "../db/index.js";
import { contextLogger } from "../core/logger.js";
import { hashString } from "../shared/hash.js";
import { env } from "../config/env.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
// Той самий бюджет часу, що й "fast"-рівень чат-запитів (llm/client.ts) — короткий текстовий
// ембединг не повинен чекати довше за швидку LLM-екстракцію.
const TIMEOUT_MS = env.llm.timeoutMsFast;
// Той самий ліміт, що й для CV/вакансій у промптах по всьому застосунку (llm/client.ts,
// writing.routes.ts тощо) — недорого й передбачувано по вхідних токенах.
const MAX_INPUT_CHARS = 8000;

export function embeddingsAvailable(): boolean {
  return env.llm.provider === "openai" && !!env.llm.openaiApiKey;
}

/**
 * Ембединг тексту або null при недоступності провайдера/порожньому вході/помилці API —
 * НІКОЛИ не кидає (graceful, як chat()). Кешується за хешем тексту+моделі в kv-сховищі:
 * той самий CV/вакансія повторно не оплачує API-виклик.
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

/** Косинусна схожість двох векторів однакової довжини: 1 = той самий напрямок, 0 = ортогональні. */
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
 * Семантична схожість двох текстів у діапазоні [0,1] (косинусна схожість ембедингів
 * OpenAI для природньої мови практично завжди невід'ємна — clamp лише запобіжник).
 * null — embeddings недоступні або запит до API не вдався для будь-якого з текстів.
 */
export async function semanticSimilarity(textA: string, textB: string): Promise<number | null> {
  const [vecA, vecB] = await Promise.all([embed(textA), embed(textB)]);
  if (!vecA || !vecB) return null;
  return Math.max(0, Math.min(1, cosineSimilarity(vecA, vecB)));
}
