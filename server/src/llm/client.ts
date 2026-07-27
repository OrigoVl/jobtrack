// LLM-шар з graceful fallback: якщо немає ключа — офлайн-режим (шаблони/словник).
import type { ZodType } from "zod";
import { getKvJson, setKvJson } from "../db/index.js";
import { contextLogger } from "../core/logger.js";
import { hashString } from "../shared/hash.js";
import { env } from "../config/env.js";

export type LlmTier = "fast" | "smart";
type LlmProvider = "openai" | "anthropic";

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

function modelForProvider(provider: LlmProvider, tier: LlmTier): string {
  if (provider === "anthropic") {
    return tier === "smart" ? env.llm.anthropicModelSmart : env.llm.anthropicModel;
  }
  return tier === "smart" ? env.llm.openaiModelSmart : env.llm.openaiModel;
}

// Порядок провайдерів для одного logічного виклику chat(): спершу вибраний (env.LLM_PROVIDER),
// і ЛИШЕ якщо в конфізі також є ключ ДРУГОГО провайдера — додаємо його як fallback. Без другого
// ключа список — рівно один елемент, тож поведінка для типової (одноключевої) конфігурації
// НЕ змінюється: жодного зайвого мережевого виклику чи іншої логіки порівняно з попередньою версією.
function availableProviders(): LlmProvider[] {
  const primary: LlmProvider = env.llm.provider;
  const secondary: LlmProvider = primary === "anthropic" ? "openai" : "anthropic";
  const hasSecondaryKey = secondary === "anthropic" ? !!env.llm.anthropicApiKey : !!env.llm.openaiApiKey;
  return hasSecondaryKey ? [primary, secondary] : [primary];
}

/**
 * Викликає LLM (OpenAI/Anthropic) з graceful offline-fallback (повертає null без ключа).
 * Форма відповіді залежить від промпту (json:true) — тип результату визначається
 * прапорцем `json` через перевантаження нижче; для json-режиму викликач може передати
 * власний generic-тип очікуваної структури (за замовчуванням — довільний об'єкт).
 * Кожен виклик все одно валідує поля вручну (typeof/Array.isArray) — LLM не гарантує
 * відповідність типу в рантаймі, лише декларує очікувану форму для компілятора.
 * Для структурованого JSON із АВТОМАТИЧНОЮ zod-валідацією + self-repair retry дивись chatJson() нижче.
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
  const mode = json ? "json" : "text";
  // Кеш-ключ свідомо включає `tier` (не конкретну модель/провайдера) — для того самого
  // system+user+tier очікується той самий "клас якості" відповіді незалежно від того, який
  // саме провайдер (primary чи fallback) зрештою відповів; при цьому зміна OPENAI_MODEL/
  // ANTHROPIC_MODEL у .env для того самого tier все ще коректно НЕ інвалідує старий кеш
  // (як і раніше) — це прийнятний тредофф, той самий, що був до fallback-логіки.
  const cacheKey = cache ? "llm:" + hashString([tier, mode, system, user].join("|")) : null;
  if (cacheKey) {
    const hit = getKvJson<{ value: LlmResult }>(cacheKey);
    if (hit) return hit.value;
  }
  const result = await callProvider(system, user, { json, maxTokens, temperature, tier });
  if (cacheKey && result != null) setKvJson(cacheKey, { value: result });
  return result;
}

/** Форма "сирого" результату виклику провайдера, до того як викликач звузить її до T через generic-перевантаження `chat`. */
type LlmResult = string | Record<string, unknown> | null;

interface CallProviderOptions {
  json: boolean;
  maxTokens: number;
  temperature: number;
  tier: LlmTier;
}

interface CallProviderOnceOptions {
  json: boolean;
  maxTokens: number;
  temperature: number;
  model: string;
  timeoutMs: number;
}

// HTTP-статуси провайдера, варті одного повтору: короткочасні збої інфраструктури
// (5xx) або перевантаження (429). Інші (400/401/404 тощо) — постійні помилки конфігурації/
// запиту, повтор їх не виправить, тож не витрачаємо на них зайвий раунд-тріп (в межах ОДНОГО
// провайдера — постійна помилка primary все одно вартий спроби secondary, якщо він налаштований).
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// Короткий фіксований backoff перед єдиним повтором — досить, щоб пережити мікро-збій
// провайдера, але не настільки довго, щоб суттєво зіпсувати відчуття швидкості для юзера.
const RETRY_DELAY_MS = 400;

/**
 * Перебирає провайдерів у порядку availableProviders() (звичайно — один; два, лише якщо
 * налаштовані ОБИДВА ключі): для кожного — до 2 спроб (оригінал + 1 retry на транзієнтну
 * помилку), і якщо провайдер повністю провалився (постійна помилка, обидві спроби
 * невдалі, чи мережевий збій) — переходить до наступного, а не одразу здається. Це
 * прибирає single point of failure для власників ОБОХ ключів: короткочасний outage/
 * rate-limit одного провайдера не кладе AI-фічі застосунку повністю в офлайн.
 */
async function callProvider(system: string, user: string, { json, maxTokens, temperature, tier }: CallProviderOptions): Promise<LlmResult> {
  const providers = availableProviders();
  const timeoutMs = tier === "smart" ? env.llm.timeoutMs : env.llm.timeoutMsFast;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]!;
    const model = modelForProvider(provider, tier);
    const isLastProvider = i === providers.length - 1;
    for (let attempt = 0; attempt < 2; attempt++) {
      const outcome = await callProviderOnce(provider, system, user, { json, maxTokens, temperature, model, timeoutMs });
      if (outcome.result != null) return outcome.result;
      if (outcome.retryable && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      break; // цей провайдер вичерпав спроби — переходимо до наступного (якщо є) поза внутрішнім циклом
    }
    if (!isLastProvider) {
      contextLogger().warn(
        { failedProvider: provider, fallbackProvider: providers[i + 1] },
        "LLM provider failed, trying fallback provider",
      );
    }
  }
  return null;
}

async function callProviderOnce(
  provider: LlmProvider,
  system: string,
  user: string,
  { json, maxTokens, temperature, model, timeoutMs }: CallProviderOnceOptions,
): Promise<{ result: LlmResult; retryable: boolean }> {
  // AbortSignal.timeout — щоб зависла відповідь провайдера не тримала запит користувача
  // (і з'єднання з сервером) необмежено довго; помилка потрапляє в catch нижче й
  // повертається як graceful offline-фолбек, а не 500/зависання.
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    if (provider === "anthropic") {
      if (!env.llm.anthropicApiKey) return { result: null, retryable: false }; // ключа немає — немає сенсу навіть намагатись
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
        contextLogger().error({ status: r.status, body: body.slice(0, 500), model, provider }, "LLM API error response");
        return { result: null, retryable: RETRYABLE_STATUSES.has(r.status) };
      }
      const d = (await r.json()) as { content?: { text?: string }[]; stop_reason?: string; usage?: Record<string, number> };
      logUsage(provider, model, d.usage);
      const text = d?.content?.[0]?.text || "";
      const result = json ? parseJsonOrLog(text, { model, provider, stopReason: d?.stop_reason }) : text;
      return { result, retryable: false };
    }
    // OpenAI
    if (!env.llm.openaiApiKey) return { result: null, retryable: false };
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
      contextLogger().error({ status: r.status, body: body.slice(0, 500), model, provider }, "LLM API error response");
      return { result: null, retryable: RETRYABLE_STATUSES.has(r.status) };
    }
    const d = (await r.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: Record<string, number>;
    };
    logUsage(provider, model, d.usage);
    const text = d?.choices?.[0]?.message?.content || "";
    const result = json ? parseJsonOrLog(text, { model, provider, stopReason: d?.choices?.[0]?.finish_reason }) : text;
    return { result, retryable: false };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    // contextLogger() підхоплює reqId поточного HTTP-запиту (якщо він є) через AsyncLocalStorage —
    // дозволяє зкорелювати цю помилку з конкретним запитом користувача в access-логах pino-http.
    contextLogger().error({ err: e, model, provider }, timedOut ? "LLM timeout" : "LLM error");
    // Мережеві помилки/таймаут — теж варті одного повтору (можуть бути мікро-збоєм з'єднання),
    // окрім явного таймауту нашого ж бюджету: якщо провайдер не встиг за timeoutMs один раз,
    // повторний виклик з тим самим бюджетом навряд встигне швидше — не витрачаємо на це раунд-тріп.
    return { result: null, retryable: !timedOut };
  }
}

export interface LlmUsage {
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Видимість вартості: жоден виклик раніше не логував скільки токенів реально спожито,
// тож не було способу оцінити $-вартість використання без сторонього биллінг-дашборду
// провайдера. Чиста функція (без побічного логування всередині) — легко тестувати
// нормалізацію напряму, не воюючи з тим, який саме інстанс pino-логера бачить тест після
// vi.resetModules() у client.test.ts. OpenAI: prompt_tokens/completion_tokens/total_tokens.
// Anthropic: input_tokens/output_tokens (без total — рахуємо самі). Нормалізуємо в одну
// форму, щоб агрегація по логах не залежала від того, який провайдер відповів.
export function normalizeUsage(provider: LlmProvider, model: string, usage: Record<string, number> | undefined): LlmUsage | null {
  if (!usage) return null;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  return { provider, model, inputTokens, outputTokens, totalTokens };
}

// info-рівень (не debug) — навмисно: має бути видимим у продакшн-логах за замовчуванням
// (LOG_LEVEL="info" — див. config/env.ts) без додаткового налаштування, щоб pino-агрегатор
// (див. README "Логування") міг рахувати суми/тренди витрат по моделі.
function logUsage(provider: LlmProvider, model: string, usage: Record<string, number> | undefined): void {
  const normalized = normalizeUsage(provider, model, usage);
  if (normalized) contextLogger().info(normalized, "LLM usage");
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
function parseJsonOrLog(text: string, ctx: { model: string; provider: LlmProvider; stopReason?: string }): Record<string, unknown> | null {
  const parsed = safeJson(text);
  if (parsed) return parsed;
  const truncated = ctx.stopReason === "length" || ctx.stopReason === "max_tokens";
  contextLogger().warn(
    { ...ctx, textLen: text.length, tail: text.slice(-200), likelyTruncated: truncated },
    truncated ? "LLM JSON response truncated by maxTokens before it closed" : "LLM JSON response failed to parse",
  );
  return null;
}

/**
 * chat() у json-режимі + АВТОМАТИЧНА zod-валідація структури + один self-repair retry.
 *
 * Раніше кожен викликач (reviewCv, matchCv, getDynamicKnowledge, /study/*, /analytics ...)
 * вручну звужував тип відповіді через typeof/Array.isArray/.filter — та сама логіка писалась
 * наново в ~11 місцях, трохи по-своєму щоразу, і жодне з них не пробувало ПОПРОСИТИ модель
 * виправити невалідну структуру — лише падали в офлайн-евристику одразу. chatJson() рухає цю
 * відповідальність в один шар: якщо перша відповідь не проходить schema.safeParse(), робимо
 * ЩЕ ОДИН виклик (у дусі того самого "рівно один retry", що вже є в callProvider() для мережевих
 * збоїв) — з поясненням, які саме поля не збіглись, і просимо модель виправити. Кеш свідомо
 * вимикається для repair-спроби (cache:false) — інакше по тому самому промпту в кеш міг би
 * потрапити невалідний RAW-результат (chat() кешує лише УСПІШНИЙ non-null результат, тож сам
 * по собі risk кешування "поламаного" JSON відсутній — але repair-запит все одно семантично
 * інший, ніж оригінальний, тож не повинен претендувати на той самий кеш-ключ).
 */
export async function chatJson<T>(
  system: string,
  user: string,
  schema: ZodType<T>,
  options: Omit<ChatOptions, "json"> = {},
): Promise<T | null> {
  const raw = await chat<Record<string, unknown>>(system, user, { ...options, json: true });
  if (raw == null) return null;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  contextLogger().warn(
    { issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) },
    "LLM JSON response failed schema validation, retrying once with a repair prompt",
  );
  const repairUser =
    `${user}\n\n---\n` +
    `Твоя попередня відповідь НЕ відповідала потрібній структурі. Помилки валідації:\n` +
    parsed.error.issues.map((i) => `- ${i.path.join(".") || "(корінь)"}: ${i.message}`).join("\n") +
    `\n\nПопередня відповідь:\n${JSON.stringify(raw).slice(0, 1500)}\n\n` +
    `Виправ і поверни ЛИШЕ валідний JSON у точно такому ж форматі, як просилось вище.`;
  const repaired = await chat<Record<string, unknown>>(system, repairUser, { ...options, json: true, cache: false });
  if (repaired == null) return null;
  const parsedRepaired = schema.safeParse(repaired);
  if (parsedRepaired.success) return parsedRepaired.data;
  contextLogger().warn(
    { issues: parsedRepaired.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) },
    "LLM JSON repair retry also failed schema validation, giving up",
  );
  return null;
}
