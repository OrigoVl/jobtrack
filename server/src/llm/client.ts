// LLM layer with graceful fallback: without a key — offline mode (templates/dictionary).
import type { ZodType } from "zod";
import { getLlmCache, setLlmCache } from "../db/llm-cache.js";
import type { UserId } from "../db/user-id.js";
import { contextLogger } from "../core/logger.js";
import { hashString } from "../shared/hash.js";
import { env } from "../config/env.js";
import { insertLlmUsage, type LlmUsageOutcome } from "../telemetry/telemetry.repo.js";
import { getLocale } from "../core/request-context.js";
import type { AppLocale } from "../shared/locale.js";

export type LlmTier = "fast" | "smart";
type LlmProvider = "openai" | "anthropic";

export interface ChatOptions {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Cache the response in the kv store by hash (system+user+model) — for stable/expensive requests. */
  cache?: boolean;
  tier?: LlmTier;
  /**
   * Which product feature this call belongs to (e.g. "cv-review", "mock-interview") — attributed
   * in the admin's cost-by-feature view (Phase 6). Optional so ad-hoc/test call sites don't need
   * one; every real call site should pass it. Falls back to "unspecified" if omitted.
   */
  feature?: string;
  /**
   * Whether this call's PROSE should follow the current request's UI language
   * (core/request-context.ts's getLocale(), sourced from the client's X-Locale header) —
   * `"app"` opts in; the default `"en"` keeps the previous, locale-independent behavior.
   *
   * Deliberately NOT a global default: roughly a third of this app's LLM prompts must never
   * follow the UI locale — either their output is matched against English identifiers downstream
   * (shared/skill-extraction.ts's extractSkills/detectDomain: translating those silently breaks
   * skill/vacancy matching, and that module's own cache is global and NOT keyed by locale, so a
   * translated result could leak across users), or they deliberately follow the SOURCE
   * DOCUMENT's language instead of the UI's (CV review/tailoring, cover letters — see
   * cv.routes.ts/writing.routes.ts/cv-linkedin.service.ts's own "respond in the resume's/
   * original language" instructions, left as-is). Only pass `"app"` for genuinely UI-facing
   * prose (study hints, interview feedback, the vacancy fit summary, etc.).
   */
  outputLocale?: "app" | "en";
}

const LANGUAGE_NAME: Record<AppLocale, string> = { en: "English", uk: "Ukrainian" };

/** Prepends a language instruction to `system` when the caller opted in via `outputLocale:
 * "app"` and the current request's locale isn't English — folded into BOTH the cache-key hash
 * and the actual provider call below, so an `en` and a `uk` response for the same prompt never
 * collide in llm_cache. */
function withLocaleInstruction(system: string, outputLocale: "app" | "en"): string {
  if (outputLocale !== "app") return system;
  const locale = getLocale();
  if (locale === "en") return system;
  return `Respond in ${LANGUAGE_NAME[locale]}. ${system}`;
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

// Provider order for a single logical chat() call: the selected one first (env.LLM_PROVIDER),
// and ONLY if the config also has a key for the SECOND provider — add it as a fallback. Without a
// second key the list is exactly one element, so behavior for a typical (single-key) configuration
// is UNCHANGED: no extra network call or other logic compared to the previous version.
function availableProviders(): LlmProvider[] {
  const primary: LlmProvider = env.llm.provider;
  const secondary: LlmProvider = primary === "anthropic" ? "openai" : "anthropic";
  const hasSecondaryKey = secondary === "anthropic" ? !!env.llm.anthropicApiKey : !!env.llm.openaiApiKey;
  return hasSecondaryKey ? [primary, secondary] : [primary];
}

/**
 * Calls the LLM (OpenAI/Anthropic) with graceful offline fallback (returns null without a key).
 * The shape of the response depends on the prompt (json:true) — the result type is determined
 * by the `json` flag via the overload below; for json mode the caller can pass its own generic
 * type for the expected structure (defaults to an arbitrary object).
 * Each call still validates fields manually (typeof/Array.isArray) — the LLM does not guarantee
 * type conformance at runtime, it only declares the expected shape for the compiler.
 * For structured JSON with AUTOMATIC zod validation + self-repair retry, see chatJson() below.
 */
export async function chat(userId: UserId, system: string, user: string, options?: ChatOptions & { json?: false }): Promise<string | null>;
export async function chat<T extends object = Record<string, unknown>>(
  userId: UserId,
  system: string,
  user: string,
  options: ChatOptions & { json: true },
): Promise<T | null>;
// `userId` attributes this call's telemetry (recordLlmUsage below) to a user for the admin's
// per-user/per-feature usage views (Phase 5/6) — the cache itself stays content-hash-keyed and
// deliberately global (see db/llm-cache.ts), not per-user.
export async function chat(userId: UserId, system: string, user: string, options: ChatOptions = {}): Promise<LlmResult> {
  const {
    json = false,
    maxTokens = 900,
    temperature = 0.4,
    cache = false,
    tier = "fast",
    feature = "unspecified",
    outputLocale = "en",
  } = options;
  if (!llmAvailable()) return null;
  // Folded in before both the cache key and the actual provider call below — see
  // withLocaleInstruction's own comment for why an `en`/`uk` response never collides in cache.
  const effectiveSystem = withLocaleInstruction(system, outputLocale);
  const mode = json ? "json" : "text";
  // The cache key deliberately includes `tier` (not the specific model/provider) — for the same
  // system+user+tier, the same "quality class" of response is expected regardless of which
  // provider (primary or fallback) ultimately answered; and changing OPENAI_MODEL/
  // ANTHROPIC_MODEL in .env for the same tier still correctly does NOT invalidate the old cache
  // (as before) — this is an acceptable tradeoff, the same one that existed before the fallback logic.
  const cacheKey = cache ? "llm:" + hashString([tier, mode, effectiveSystem, user].join("|")) : null;
  if (cacheKey) {
    const hit = await getLlmCache<{ value: LlmResult }>(cacheKey);
    if (hit) {
      // provider/model are deliberately null: the cache is tier-scoped, not provider-scoped, so
      // there's no truthful single provider/model to attribute a hit to (see db/schema/app.ts's
      // llmCache comment) — and 0 tokens/cost genuinely is what a cache hit costs.
      recordLlmUsage({
        userId,
        feature,
        tier,
        provider: null,
        model: null,
        usage: null,
        cacheHit: true,
        latencyMs: 0,
        outcome: "cache_hit",
      });
      return hit.value;
    }
  }
  const started = Date.now();
  const { result, provider, model, usage } = await callProvider(effectiveSystem, user, { json, maxTokens, temperature, tier });
  recordLlmUsage({
    userId,
    feature,
    tier,
    provider,
    model,
    usage,
    cacheHit: false,
    latencyMs: Date.now() - started,
    outcome: result != null ? "success" : "error",
  });
  if (cacheKey && result != null) await setLlmCache(cacheKey, { value: result });
  return result;
}

/** The shape of the "raw" provider call result, before the caller narrows it to T via `chat`'s generic overload. */
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

// Provider HTTP statuses worth a single retry: transient infrastructure failures
// (5xx) or overload (429). Others (400/401/404 etc.) are permanent config/request errors —
// a retry won't fix them, so we don't spend an extra round trip on them (within a SINGLE
// provider — a permanent failure of the primary is still worth trying the secondary, if configured).
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// A short fixed backoff before the single retry — enough to ride out a provider micro-outage,
// but not so long that it noticeably hurts the user's perceived speed.
const RETRY_DELAY_MS = 400;

/** What actually happened for one chat() call — enough for recordLlmUsage() to attribute cost
 * even when the result is null (provider/model of the LAST attempt, so a total failure is still
 * traceable to which model/provider was tried). */
interface CallProviderResult {
  result: LlmResult;
  provider: LlmProvider | null;
  model: string | null;
  usage: LlmUsage | null;
}

/**
 * Iterates over providers in availableProviders() order (usually one; two only if
 * BOTH keys are configured): for each — up to 2 attempts (original + 1 retry on a transient
 * error), and if the provider fails completely (permanent error, both attempts
 * failed, or a network failure) — moves on to the next one instead of giving up immediately. This
 * removes the single point of failure for owners of BOTH keys: a short outage/
 * rate limit on one provider does not put the app's AI features fully offline.
 */
async function callProvider(
  system: string,
  user: string,
  { json, maxTokens, temperature, tier }: CallProviderOptions,
): Promise<CallProviderResult> {
  const providers = availableProviders();
  const timeoutMs = tier === "smart" ? env.llm.timeoutMs : env.llm.timeoutMsFast;
  let lastProvider: LlmProvider | null = null;
  let lastModel: string | null = null;
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]!;
    const model = modelForProvider(provider, tier);
    lastProvider = provider;
    lastModel = model;
    const isLastProvider = i === providers.length - 1;
    for (let attempt = 0; attempt < 2; attempt++) {
      const outcome = await callProviderOnce(provider, system, user, { json, maxTokens, temperature, model, timeoutMs });
      if (outcome.result != null) return { result: outcome.result, provider, model, usage: outcome.usage };
      if (outcome.retryable && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      break; // this provider has exhausted its attempts — move to the next one (if any) outside the inner loop
    }
    if (!isLastProvider) {
      contextLogger().warn(
        { failedProvider: provider, fallbackProvider: providers[i + 1] },
        "LLM provider failed, trying fallback provider",
      );
    }
  }
  return { result: null, provider: lastProvider, model: lastModel, usage: null };
}

async function callProviderOnce(
  provider: LlmProvider,
  system: string,
  user: string,
  { json, maxTokens, temperature, model, timeoutMs }: CallProviderOnceOptions,
): Promise<{ result: LlmResult; retryable: boolean; usage: LlmUsage | null }> {
  // AbortSignal.timeout — so a stuck provider response doesn't hold the user's request
  // (and the server connection) indefinitely; the error is caught below and
  // returned as a graceful offline fallback, not a 500/hang.
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    if (provider === "anthropic") {
      if (!env.llm.anthropicApiKey) return { result: null, retryable: false, usage: null }; // no key — no point even trying
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
      // Previously r.ok was not checked here: a provider that responded 401/404/429/500 with a JSON body
      // SHAPED like {"error": {...}} (rather than {"content": [...]}) silently produced text="" (d?.content?.[0]?.text
      // doesn't exist) — and callProvider returned null exactly as it would for a legitimate empty response.
      // Callers (reviewCv/matchCv etc.) couldn't tell "provider unavailable/API error" apart
      // from "response failed to parse", and silently fell back to the offline heuristic WITHOUT any log of the reason.
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        contextLogger().error({ status: r.status, body: body.slice(0, 500), model, provider }, "LLM API error response");
        return { result: null, retryable: RETRYABLE_STATUSES.has(r.status), usage: null };
      }
      const d = (await r.json()) as { content?: { text?: string }[]; stop_reason?: string; usage?: Record<string, number> };
      const usage = normalizeUsage(provider, model, d.usage);
      const text = d?.content?.[0]?.text || "";
      const result = json ? parseJsonOrLog(text, { model, provider, stopReason: d?.stop_reason }) : text;
      return { result, retryable: false, usage };
    }
    // OpenAI
    if (!env.llm.openaiApiKey) return { result: null, retryable: false, usage: null };
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
      return { result: null, retryable: RETRYABLE_STATUSES.has(r.status), usage: null };
    }
    const d = (await r.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: Record<string, number>;
    };
    const usage = normalizeUsage(provider, model, d.usage);
    const text = d?.choices?.[0]?.message?.content || "";
    const result = json ? parseJsonOrLog(text, { model, provider, stopReason: d?.choices?.[0]?.finish_reason }) : text;
    return { result, retryable: false, usage };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    // contextLogger() picks up the current HTTP request's reqId (if any) via AsyncLocalStorage —
    // this lets us correlate this error with a specific user request in the pino-http access logs.
    contextLogger().error({ err: e, model, provider }, timedOut ? "LLM timeout" : "LLM error");
    // Network errors/timeouts are also worth one retry (could be a connection micro-glitch),
    // except for an explicit timeout of our own budget: if the provider didn't make it within timeoutMs once,
    // a retry with the same budget is unlikely to be faster — we don't spend a round trip on that.
    return { result: null, retryable: !timedOut, usage: null };
  }
}

export interface LlmUsage {
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Cost visibility: no call previously logged how many tokens were actually consumed,
// so there was no way to estimate the $ cost of usage without the provider's third-party
// billing dashboard. A pure function (no side-effect logging inside) — easy to test the
// normalization directly, without fighting over which pino logger instance the test sees after
// vi.resetModules() in client.test.ts. OpenAI: prompt_tokens/completion_tokens/total_tokens.
// Anthropic: input_tokens/output_tokens (no total — we compute it ourselves). We normalize into one
// shape so log aggregation doesn't depend on which provider answered.
export function normalizeUsage(provider: LlmProvider, model: string, usage: Record<string, number> | undefined): LlmUsage | null {
  if (!usage) return null;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  return { provider, model, inputTokens, outputTokens, totalTokens };
}

interface RecordLlmUsageInput {
  userId: UserId;
  feature: string;
  tier: LlmTier;
  provider: LlmProvider | null;
  model: string | null;
  usage: LlmUsage | null;
  cacheHit: boolean;
  latencyMs: number;
  outcome: LlmUsageOutcome;
}

// Emits telemetry for exactly one chat() call (cache hit, successful provider response, or a
// total failure) — every code path in chat() above calls this exactly once, so cost/usage
// admin views (Phase 6) see one row per logical call, not one per provider retry attempt.
// info level (not debug) — deliberately: this must be visible in production logs by default
// (LOG_LEVEL="info" — see config/env.ts) without extra configuration, so the pino aggregator
// (see README "Logging") can compute cost totals/trends per model even before the admin panel
// exists. The DB insert is fire-and-forget (see telemetry.repo.ts's own doc comment) — this
// function itself is synchronous from the caller's point of view, it never returns a promise
// chat() would need to await, so persisting telemetry can never add latency to a user's request.
function recordLlmUsage({ userId, feature, tier, provider, model, usage, cacheHit, latencyMs, outcome }: RecordLlmUsageInput): void {
  contextLogger().info({ feature, tier, provider, model, usage, cacheHit, latencyMs, outcome }, "LLM usage");
  void insertLlmUsage({
    userId,
    feature,
    provider,
    model,
    tier,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    cacheHit,
    latencyMs,
    outcome,
  });
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
 * safeJson() + logging the failure reason. Previously a failed JSON-mode parse (response_format
 * json_object in OpenAI guarantees syntactic validity ONLY if the generation wasn't cut off) went
 * completely silently: HTTP 200, r.ok===true, so the error branch in callProvider never fired, and
 * callers (reviewCv/matchCv etc.) simply fell back to the offline heuristic without any log of the reason.
 * The most common cause — generation was cut off by `maxTokens` BEFORE the JSON closed (finish_reason /
 * stop_reason === "length"/"max_tokens") — the model readily generates longer strengths/issues/rewrites
 * than the allotted token budget. We log the finishReason and the tail of the text (where the cutoff is
 * visible) so this cause can be diagnosed from the logs instead of guessing from response time.
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
 * chat() in json mode + AUTOMATIC zod schema validation + one self-repair retry.
 *
 * Previously every caller (reviewCv, matchCv, getDynamicKnowledge, /study/*, /analytics ...)
 * manually narrowed the response type via typeof/Array.isArray/.filter — the same logic was
 * rewritten in ~11 places, each slightly differently, and none of them tried to ASK the model
 * to fix an invalid structure — they just fell back to the offline heuristic immediately. chatJson() moves
 * that responsibility into one layer: if the first response doesn't pass schema.safeParse(), we make
 * ONE MORE call (in the spirit of the same "exactly one retry" that already exists in callProvider() for
 * network failures) — explaining exactly which fields didn't match, and asking the model to fix them. Caching
 * is deliberately disabled for the repair attempt (cache:false) — otherwise an invalid RAW result could
 * end up in the cache for the same prompt (chat() only caches a SUCCESSFUL non-null result, so there's
 * no actual risk of caching "broken" JSON by itself — but the repair request is still semantically
 * different from the original, so it shouldn't claim the same cache key).
 */
export async function chatJson<T>(
  userId: UserId,
  system: string,
  user: string,
  schema: ZodType<T>,
  options: Omit<ChatOptions, "json"> = {},
): Promise<T | null> {
  const raw = await chat<Record<string, unknown>>(userId, system, user, { ...options, json: true });
  if (raw == null) return null;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  contextLogger().warn(
    { issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) },
    "LLM JSON response failed schema validation, retrying once with a repair prompt",
  );
  const repairUser =
    `${user}\n\n---\n` +
    `Your previous response did NOT match the required structure. Validation errors:\n` +
    parsed.error.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n") +
    `\n\nPrevious response:\n${JSON.stringify(raw).slice(0, 1500)}\n\n` +
    `Fix it and return ONLY valid JSON in exactly the same format as requested above.`;
  const repaired = await chat<Record<string, unknown>>(userId, system, repairUser, { ...options, json: true, cache: false });
  if (repaired == null) return null;
  const parsedRepaired = schema.safeParse(repaired);
  if (parsedRepaired.success) return parsedRepaired.data;
  contextLogger().warn(
    { issues: parsedRepaired.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) },
    "LLM JSON repair retry also failed schema validation, giving up",
  );
  return null;
}
