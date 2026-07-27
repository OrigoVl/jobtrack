// LLM-шар з graceful fallback: якщо немає ключа — офлайн-режим (шаблони/словник).
import { getKvJson, setKvJson } from "../db/index.js";
import logger from "../core/logger.js";
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
 * Повертає `any`, бо форма відповіді залежить від конкретного промпту (json:true) —
 * кожен виклик валідує поля вручну одразу після отримання (typeof-перевірки нижче по коду).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chat(system: string, user: string, options: ChatOptions = {}): Promise<any> {
  const { json = false, maxTokens = 900, temperature = 0.4, cache = false, tier = "fast" } = options;
  if (!llmAvailable()) return null;
  const model = modelFor(tier);
  const mode = json ? "json" : "text";
  const cacheKey = cache ? "llm:" + hashString([model, mode, system, user].join("|")) : null;
  if (cacheKey) {
    const hit = getKvJson<{ value: unknown }>(cacheKey);
    if (hit) return hit.value;
  }
  const result = await callProvider(system, user, { json, maxTokens, temperature, model });
  if (cacheKey && result != null) setKvJson(cacheKey, { value: result });
  return result;
}

interface CallProviderOptions {
  json: boolean;
  maxTokens: number;
  temperature: number;
  model: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callProvider(system: string, user: string, { json, maxTokens, temperature, model }: CallProviderOptions): Promise<any> {
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
      const d = (await r.json()) as { content?: { text?: string }[] };
      const text = d?.content?.[0]?.text || "";
      return json ? safeJson(text) : text;
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
    const d = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = d?.choices?.[0]?.message?.content || "";
    return json ? safeJson(text) : text;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    logger.error({ err: e }, timedOut ? "LLM timeout" : "LLM error");
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
