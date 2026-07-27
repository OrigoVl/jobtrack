// LLM-шар з graceful fallback: якщо немає ключа — офлайн-режим (шаблони/словник).
import { getKvJson, setKvJson } from "../db/index.js";
import { contextLogger } from "../core/logger.js";
import { hashString } from "../shared/hash.js";
import { env } from "../config/env.js";

export type LlmTier = "fast" | "smart";

export interface ChatOptions {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Кешувати відповідь у kv-сховищі за хешем (system+user+model) — для стабільних/дорогих запитів. */
  cache?: boolean;
  tier?: LlmTier;
}

export function llmAvailable(): boolean {
  return env.llm.isAvailable;
}

// Два рівні моделі: "fast" — дешева (екстракція, підказки), "smart" — сильніша (поради, оцінки, генерація).
// Керується змінними оточення; за замовчуванням — розумні пресети для якості.
function modelFor(tier: LlmTier): string {
  if (env.llm.provider === "anthropic") {
    return tier === "smart" ? env.llm.anthropicModelSmart : env.llm.anthropicModel;
  }
  return tier === "smart" ? env.llm.openaiModelSmart : env.llm.openaiModel;
}

/**
 * Викликає LLM (OpenAI/Anthropic) з graceful offline-fallback (повертає null без ключа).
 * Форма відповіді залежить від промпту (json:true) — тип результату визначається
 * прапорцем `json` через перевантаження нижче; для json-режиму викликач може передати
 * власний generic-тип очікуваної структури (за замовчуванням — довільний об'єкт).
 * Кожен виклик все одно валідує поля вручну (typeof/Array.isArray) — LLM не гарантує
 * відповідність типу в рантаймі, лише декларує очікувану форму для компілятора.
 */
export async function chat(system: string, user: string, options?: ChatOptions & { json?: false }): Promise<string | null>;
export async function chat<T extends object = Record<string, unknown>>(
  system: string,
  user: string,
  options: ChatOptions & { json: true },
): Promise<T | null>;
export async function chat(system: string, user: string, options: ChatOptions = {}): Promise<LlmResult> {
  const { json = false, maxTokens = 900, temperature = 0.4, cache = false, tier = "fast" } = options;
  if (!llmAvailable()) return null;
  const model = modelFor(tier);
  const mode = json ? "json" : "text";
  const cacheKey = cache ? "llm:" + hashString([model, mode, system, user].join("|")) : null;
  if (cacheKey) {
    const hit = getKvJson<{ value: LlmResult }>(cacheKey);
    if (hit) return hit.value;
  }
  const result = await callProvider(system, user, { json, maxTokens, temperature, model });
  if (cacheKey && result != null) setKvJson(cacheKey, { value: result });
  return result;
}

/** Форма "сирого" результату виклику провайдера, до того як викликач звузить її до T через generic-перевантаження `chat`. */
type LlmResult = string | Record<string, unknown> | null;

interface CallProviderOptions {
  json: boolean;
  maxTokens: number;
  temperature: number;
  model: string;
}

async function callProvider(
  system: string,
  user: string,
  { json, maxTokens, temperature, model }: CallProviderOptions,
): Promise<LlmResult> {
  // AbortSignal.timeout — щоб зависла відповідь провайдера не тримала запит користувача
  // (і з'єднання з сервером) необмежено довго; помилка потрапляє в catch нижче й
  // повертається як graceful offline-фолбек, а не 500/зависання.
  const signal = AbortSignal.timeout(env.llm.timeoutMs);
  try {
    if (env.llm.provider === "anthropic" && env.llm.anthropicApiKey) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": env.llm.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      // Раніше тут не перевірявся r.ok: провайдер, що відповів 401/404/429/500 з JSON-тілом
      // ФОРМИ {"error": {...}} (а не {"content": [...]}), тихо давав text="" (d?.content?.[0]?.text
      // не існує) — і callProvider повертав null так само, як при легітимній порожній відповіді.
      // Викликачі (reviewCv/matchCv тощо) не могли відрізнити "провайдер недоступний/помилка API"
      // від "відповідь не розпарсилась", і мовчки йшли в offline-евристику БЕЗ жодного логу причини.
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        contextLogger().error({ status: r.status, body: body.slice(0, 500), model, provider: "anthropic" }, "LLM API error response");
        return null;
      }
      const d = (await r.json()) as { content?: { text?: string }[]; stop_reason?: string };
      const text = d?.content?.[0]?.text || "";
      return json ? parseJsonOrLog(text, { model, provider: "anthropic", stopReason: d?.stop_reason }) : text;
    }
    // OpenAI (default)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${env.llm.openaiApiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      contextLogger().error({ status: r.status, body: body.slice(0, 500), model, provider: "openai" }, "LLM API error response");
      return null;
    }
    const d = (await r.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
    const text = d?.choices?.[0]?.message?.content || "";
    return json ? parseJsonOrLog(text, { model, provider: "openai", stopReason: d?.choices?.[0]?.finish_reason }) : text;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    // contextLogger() підхоплює reqId поточного HTTP-запиту (якщо він є) через AsyncLocalStorage —
    // дозволяє зкорелювати цю помилку з конкретним запитом користувача в access-логах pino-http.
    contextLogger().error({ err: e, model }, timedOut ? "LLM timeout" : "LLM error");
    return null;
  }
}

function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * safeJson() + логування причини провалу. Раніше невдалий парсинг JSON-режиму (response_format
 * json_object в OpenAI гарантує синтаксичну валідність ЛИШЕ якщо генерація не обрізана) проходив
 * повністю мовчки: HTTP 200, r.ok===true, тож гілка помилки в callProvider не спрацьовувала, і
 * викликачі (reviewCv/matchCv тощо) просто тихо йшли в офлайн-евристику без жодного логу причини.
 * Найчастіша причина — generation обірвалась по `maxTokens` ДО завершення JSON (finish_reason /
 * stop_reason === "length"/"max_tokens") — модель охоче генерує довші strengths/issues/rewrites,
 * ніж закладений бюджет токенів. Логуємо finishReason і хвіст тексту (де і видно обрив), щоб таку
 * причину можна було діагностувати з логів, а не гадати за response time.
 */
function parseJsonOrLog(
  text: string,
  ctx: { model: string; provider: "openai" | "anthropic"; stopReason?: string },
): Record<string, unknown> | null {
  const parsed = safeJson(text);
  if (parsed) return parsed;
  const truncated = ctx.stopReason === "length" || ctx.stopReason === "max_tokens";
  contextLogger().warn(
    { ...ctx, textLen: text.length, tail: text.slice(-200), likelyTruncated: truncated },
    truncated ? "LLM JSON response truncated by maxTokens before it closed" : "LLM JSON response failed to parse",
  );
  return null;
}
