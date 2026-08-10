// Contract tests for the LLM client's offline fallback: regardless of what the caller asks for,
// without a configured provider key `chat()` MUST return null instead of throwing
// or trying to reach the network. This is the core contract that all
// services (writing, knowledge, cv-analysis, etc.) rely on for graceful degradation without an API key.
//
// process.env is stubbed to undefined (not "") — an empty string doesn't pass
// `.trim().min(1).optional()` in config/env.ts and would fail the validation process (the same
// nuance as in playwright.config.ts for e2e). vi.resetModules() + a dynamic import
// are needed because env.ts reads process.env once at import time (the module is cached).
//
// db/llm-cache.js is mocked because client.ts imports getLlmCache/setLlmCache from there only
// for the optional response cache — the real module opens a Postgres connection pool, which we
// don't want in a unit test (the test must stay isolated from the db).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../db/user-id.js";

vi.mock("../db/llm-cache.js", () => ({
  getLlmCache: vi.fn(() => null),
  setLlmCache: vi.fn(),
}));
// telemetry.repo.js lazily imports db/client.js only when actually invoked (see its own doc
// comment) precisely so tests like this one don't need a real Postgres connection — but
// chat()'s recordLlmUsage() DOES call insertLlmUsage() on every code path (cache hit, success,
// error), so we still stub it out here rather than let a real (fire-and-forget, harmlessly-
// failing) DB call happen during a unit test.
vi.mock("../telemetry/telemetry.repo.js", () => ({
  insertLlmUsage: vi.fn(),
  insertProductEvent: vi.fn(),
  getUserCostUsdSince: vi.fn(() => 0),
}));
// modules/billing/entitlements.js's getSubscription() (via billing.repo.ts) opens a real
// Postgres connection, same reasoning as the telemetry mock above — this keeps EVERY test in
// this file from touching a database regardless of whether env.billing.isAvailable is true.
vi.mock("../modules/billing/entitlements.js", () => ({
  getAiQuotaState: vi.fn(() => ({ allowed: true, used: 0, limit: null, resetsAt: null })),
}));

describe("chat() / llmAvailable() offline fallback", () => {
  beforeAll(async () => {
    // "dotenv/config" is an external package (not a file under src/), so vi.resetModules() doesn't touch
    // its cache: the side effect (populating process.env) runs only ONCE for the
    // lifetime of the process. We warm it up here, before the first vi.stubEnv below — otherwise the first
    // dynamic import in the tests would trigger a deferred dotenv.config(), which would overwrite the just-
    // deleted variable with the real value from server/.env.
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("llmAvailable() is false when no provider key is configured", async () => {
    const { llmAvailable } = await import("./client.js");
    expect(llmAvailable()).toBe(false);
  });

  it("chat() resolves to null in text mode without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system prompt", "user prompt");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("chat() resolves to null in json mode without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat<{ focus: string }>(BOOTSTRAP_USER_ID, "system prompt", "user prompt", { json: true });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// Regression: a provider responding with a non-2xx status (invalid key, rate limit, temporary
// error) was previously not checked via r.ok — callProvider would silently try to read the error body
// as a successful response (d?.choices?.[0]?.message?.content doesn't exist → text=""), and callers
// (reviewCv/matchCv etc.) couldn't tell "the provider returned an error" apart from "a legitimate
// empty response" — both cases looked like null with no log of the reason.
describe("chat() surfaces provider failures instead of a silent null", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns null (not a thrown error) when the provider keeps responding with a non-2xx status", async () => {
    // 429 is retryable, so mockResolvedValue (without .Once) means BOTH attempts (original +
    // 1 retry) get the same 429 — and the result is still null, not a thrown error.
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBeNull();
  });

  it("returns null in json mode when the response is HTTP-ok but truncated/invalid JSON", async () => {
    // Simulates the most common cause of silent failure: generation was cut off by maxTokens
    // BEFORE the JSON closed (response_format:json_object only guarantees validity WITHOUT a cutoff) —
    // HTTP 200/ok, so the r.ok check doesn't catch it, and previously this looked like a plain null.
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"score":80,"summary":"An unfinished string cut off mid-sente' }, finish_reason: "length" }],
      }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat<{ score: number }>(BOOTSTRAP_USER_ID, "system", "user", { json: true });
    expect(result).toBeNull();
  });

  it("retries once on a transient 429 and succeeds if the second attempt is ok", async () => {
    // Simulates a transient provider overload: first attempt 429, second — successful.
    // callProvider() must recognize 429 as "worth a retry" and make EXACTLY one retry.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "ok after retry" }, finish_reason: "stop" }] }),
      } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok after retry");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry on a permanent 401 (bad api key) — fails fast with a single call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns the parsed object in json mode when the provider responds with valid, complete JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"score":80,"summary":"ok"}' }, finish_reason: "stop" }],
      }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat<{ score: number; summary: string }>(BOOTSTRAP_USER_ID, "system", "user", { json: true });
    expect(result).toEqual({ score: 80, summary: "ok" });
  });
});

// Regression/feature: previously client.ts hard-coded a single provider (env.LLM_PROVIDER) — a short
// outage/rate-limit of that ONE provider put all AI features offline, even if the owner
// happened to also have a SECOND key configured. Now, if BOTH keys are set, a primary provider
// that fails completely (after its own attempt+retry) is automatically retried via the secondary.
describe("callProvider() falls back to the secondary provider", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tries anthropic after openai fails permanently (401), when both keys are configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("openai.com")) {
        return { ok: false, status: 401, text: async () => JSON.stringify({ error: { message: "Invalid API key" } }) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: "answer from anthropic" }], stop_reason: "end_turn" }),
      } as Response;
    });
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("answer from anthropic");
    // openai: 1 call (401 is not retryable, no internal retry) + anthropic: 1 call = 2 total.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]![0])).toContain("openai.com");
    expect(String(fetchSpy.mock.calls[1]![0])).toContain("anthropic.com");
  });

  it("tries anthropic after openai exhausts its own retry on a transient 429", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("openai.com")) {
        return { ok: false, status: 429, text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } }) } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: "answer from anthropic" }], stop_reason: "end_turn" }),
      } as Response;
    });
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("answer from anthropic");
    // openai: 2 calls (original + 1 retry on 429) + anthropic: 1 call = 3 total.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("does NOT fall back when only one provider key is configured (default single-provider behavior unchanged)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null when BOTH providers are fully unavailable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2); // one attempt each (both 401 — not retryable)
  });
});

// Anthropic prompt caching (https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching):
// the system prompt is sent as a content-block array with cache_control so repeated calls sharing
// the same system prompt (CV-review rubric, mock-interview grading rubric, ...) are served from
// Anthropic's cache instead of reprocessed at full cost every time. OpenAI has no equivalent
// mechanism here, so its request body must stay untouched (plain string `content`).
describe("callProviderOnce() Anthropic system-prompt caching", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the Anthropic system prompt as an ephemeral-cached content block, not a plain string", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }], stop_reason: "end_turn" }),
    } as Response);
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "you are a helpful rubric-grading assistant", "user");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.system).toEqual([
      { type: "text", text: "you are a helpful rubric-grading assistant", cache_control: { type: "ephemeral" } },
    ]);
  });
});

// The OpenAI request body has two model-dependent fields. Getting either wrong is a 400 from the
// provider, which the client turns into its offline fallback — so the app looks like it simply
// "has no AI" rather than like it's sending a malformed request. That's exactly how this shipped
// broken: OPENAI_MODEL_SMART defaulted to gpt-5 back then, so the whole smart tier 400'd while
// the fast tier (gpt-4o-mini) kept working. The default has since moved off the reasoning models
// (config/env.ts), which is why these tests pin the model per case instead of relying on it.
describe("callProviderOnce() OpenAI request body per model family", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockOpenAiOk() {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
  }

  it("never sends the legacy max_tokens field, which the reasoning models reject outright", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    const fetchSpy = mockOpenAiOk();
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user", { maxTokens: 123 });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.max_completion_tokens).toBe(123);
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("omits temperature for a reasoning model, which only accepts its default of 1", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");
    const fetchSpy = mockOpenAiOk();
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user", { temperature: 0.4 });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body).not.toHaveProperty("temperature");
  });

  it("still sends temperature for a gpt-4 generation model, which supports it", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    const fetchSpy = mockOpenAiOk();
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user", { temperature: 0.4 });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.temperature).toBe(0.4);
  });

  it("skips temperature up front for the Anthropic models that dropped it, sparing the fallback a round trip", async () => {
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_MODEL_SMART", "claude-sonnet-5");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }], stop_reason: "end_turn" }),
    } as Response);
    const { chat } = await import("./client.js");

    await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart", temperature: 0.3 });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body))).not.toHaveProperty("temperature");
    // Exactly one call: the point is that no 400-then-resend happened.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "fast", temperature: 0.3 });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)).temperature).toBe(0.3);
  });

  it("classifies the Anthropic models that dropped temperature by name, sparing Haiku 4.5", async () => {
    const { isAnthropicModelWithoutTemperature } = await import("./client.js");
    expect(isAnthropicModelWithoutTemperature("claude-sonnet-5")).toBe(true);
    expect(isAnthropicModelWithoutTemperature("claude-opus-5")).toBe(true);
    expect(isAnthropicModelWithoutTemperature("claude-haiku-4-5-20251001")).toBe(false);
  });

  it("classifies both reasoning families by name, and anything unknown as non-reasoning", async () => {
    const { isOpenAiReasoningModel } = await import("./client.js");
    expect(isOpenAiReasoningModel("gpt-5")).toBe(true);
    expect(isOpenAiReasoningModel("gpt-5-mini")).toBe(true);
    expect(isOpenAiReasoningModel("o3-2025-04-16")).toBe(true);
    expect(isOpenAiReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isOpenAiReasoningModel("some-future-model")).toBe(false);
  });
});

// Claude Sonnet 5's `output_config.effort` (Anthropic Messages API): only ever meaningful for the
// "smart" tier — Haiku 4.5 ("fast" tier) doesn't support the parameter at all and 400s if it's
// sent. Mirrors the "callProviderOnce() Anthropic system-prompt caching" setup above (anthropic
// provider configured) since `effort` is only ever forwarded on that branch.
describe("chat() Sonnet 5 effort (output_config)", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockOkAnthropicFetch() {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ text: "ok" }], stop_reason: "end_turn" }),
    } as Response);
  }

  it("defaults a smart-tier call to output_config: {effort: 'medium'} when no explicit effort is passed", async () => {
    const fetchSpy = mockOkAnthropicFetch();
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart" });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.output_config).toEqual({ effort: "medium" });
  });

  it("respects an explicit effort override on a smart-tier call instead of the 'medium' default", async () => {
    const fetchSpy = mockOkAnthropicFetch();
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart", effort: "high" });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.output_config).toEqual({ effort: "high" });
  });

  it("never sends output_config at all for a fast-tier call (Haiku doesn't support effort)", async () => {
    const fetchSpy = mockOkAnthropicFetch();
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user");
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.output_config).toBeUndefined();
  });

  it("drops effort when a smart-tier call is downgraded to fast by the daily cost cap", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getUserCostUsdSince, insertLlmUsage } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(1);
    const fetchSpy = mockOkAnthropicFetch();
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart", feature: "cv-review" });
    expect(result).toBe("ok");
    // Confirms this really is the downgraded (fast) request, not the original smart-tier one,
    // before asserting effort is gone.
    expect(insertLlmUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: "cv-review", tier: "fast", outcome: "success" }));
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.output_config).toBeUndefined();
  });

  // Regression test: ANTHROPIC_MODEL_SMART is user-configurable and can point at a snapshot older
  // than the one that introduced `effort` support — every "smart" call used to 400 permanently for
  // that account (a config mismatch masquerading as "the LLM is down"), because a 400 isn't in
  // RETRYABLE_STATUSES and the outer retry loop resends the identical (still-400ing) request
  // anyway. callProviderOnce now recognizes this specific error and resends once without the field.
  it("retries once without output_config when the model rejects the effort parameter, and succeeds", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: "This model does not support the effort parameter." } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: "ok" }], stop_reason: "end_turn" }),
      } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart" });
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)).output_config).toEqual({ effort: "medium" });
    expect(JSON.parse(String(fetchSpy.mock.calls[1]![1]?.body)).output_config).toBeUndefined();
  });

  // Same class of bug as the effort one above, discovered while picking a replacement model:
  // Claude Sonnet 5 accepts `effort` but rejects `temperature` outright ("`temperature` is
  // deprecated for this model") — so the two capability checks must be independent, not an
  // either/or, or a model missing ONE of them would still permanently 400 after "recovering".
  // Pinned to a model that is NOT on isAnthropicModelWithoutTemperature's list: for the ones that
  // are, `temperature` is never sent in the first place, so there'd be no 400 to recover from and
  // this path would go untested. The recovery exists precisely for the models the list doesn't
  // know about — an older/newer snapshot someone points ANTHROPIC_MODEL_SMART at.
  it("retries once without temperature when an unrecognized model rejects it, keeping effort", async () => {
    vi.stubEnv("ANTHROPIC_MODEL_SMART", "claude-sonnet-4-5-20250929");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: "`temperature` is deprecated for this model." } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: "ok" }], stop_reason: "end_turn" }),
      } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart" });
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body)).temperature).toBe(0.4);
    const retryBody = JSON.parse(String(fetchSpy.mock.calls[1]![1]?.body));
    expect(retryBody.temperature).toBeUndefined();
    expect(retryBody.output_config).toEqual({ effort: "medium" });
  });

  it("does not retry-without-effort for an unrelated 400 (fails fast, one call)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "max_tokens is too large for this model." } }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart" });
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// Cost visibility: normalizes the provider's usage fields (prompt_tokens/completion_tokens
// for OpenAI, input_tokens/output_tokens for Anthropic) into ONE shape for logs/aggregation.
describe("normalizeUsage()", () => {
  it("maps OpenAI's prompt_tokens/completion_tokens/total_tokens as-is", async () => {
    const { normalizeUsage } = await import("./client.js");
    const result = normalizeUsage("openai", "gpt-4o-mini", { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 });
    expect(result).toEqual({ provider: "openai", model: "gpt-4o-mini", inputTokens: 120, outputTokens: 40, totalTokens: 160 });
  });

  it("maps Anthropic's input_tokens/output_tokens and derives totalTokens (no total field from Anthropic)", async () => {
    const { normalizeUsage } = await import("./client.js");
    const result = normalizeUsage("anthropic", "claude-haiku-4-5", { input_tokens: 200, output_tokens: 55 });
    expect(result).toEqual({ provider: "anthropic", model: "claude-haiku-4-5", inputTokens: 200, outputTokens: 55, totalTokens: 255 });
  });

  it("returns null when the provider response had no usage field at all", async () => {
    const { normalizeUsage } = await import("./client.js");
    expect(normalizeUsage("openai", "gpt-4o-mini", undefined)).toBeNull();
  });
});

// outputLocale: "app" (default "en") opts a call into following the current request's UI
// language (core/request-context.ts's getLocale(), see llm/client.ts's own ChatOptions doc) —
// most call sites must NOT do this (see skill-extraction.ts/cv.routes.ts's own comments), so this
// locks in exactly what changes when a call DOES opt in.
describe("chat() outputLocale", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prepends a language instruction only when outputLocale is 'app' and the request locale isn't English", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const { runWithRequestContext } = await import("../core/request-context.js");
    await runWithRequestContext("req-1", "uk", () => chat(BOOTSTRAP_USER_ID, "You are a mentor.", "user", { outputLocale: "app" }));
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.messages[0].content).toBe("Respond in Ukrainian. You are a mentor.");
  });

  it("leaves the prompt untouched when outputLocale is omitted, even under a non-English request locale", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const { runWithRequestContext } = await import("../core/request-context.js");
    await runWithRequestContext("req-1", "uk", () => chat(BOOTSTRAP_USER_ID, "You are a mentor.", "user"));
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.messages[0].content).toBe("You are a mentor.");
  });

  it("leaves the prompt untouched when the request locale is English, even with outputLocale: 'app'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const { runWithRequestContext } = await import("../core/request-context.js");
    await runWithRequestContext("req-1", "en", () => chat(BOOTSTRAP_USER_ID, "You are a mentor.", "user", { outputLocale: "app" }));
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.messages[0].content).toBe("You are a mentor.");
  });

  it("gives an 'en' and a 'uk' response for the same prompt separate cache keys", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { setLlmCache } = await import("../db/llm-cache.js");
    const { chat } = await import("./client.js");
    const { runWithRequestContext } = await import("../core/request-context.js");
    await runWithRequestContext("req-1", "en", () =>
      chat(BOOTSTRAP_USER_ID, "You are a mentor.", "user", { outputLocale: "app", cache: true }),
    );
    await runWithRequestContext("req-2", "uk", () =>
      chat(BOOTSTRAP_USER_ID, "You are a mentor.", "user", { outputLocale: "app", cache: true }),
    );
    const keys = vi.mocked(setLlmCache).mock.calls.map((call) => call[0]);
    expect(keys[0]).not.toBe(keys[1]);
  });
});

// env.llm.dailyCostCapUsd (default 0/disabled): a soft per-user daily $ cap, checked only on a
// cache miss (a cache hit is free and must never be blocked by it — see the "hit" test below).
describe("chat() daily cost cap", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    // Clears call history (NOT the factory-set default implementations above) on
    // getUserCostUsdSince/insertLlmUsage/getLlmCache — each test below explicitly sets its own
    // mockResolvedValue where it matters, this just keeps the toHaveBeenCalled() assertions
    // clean of calls made by earlier tests in this describe block.
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls the provider normally when the cap is disabled (default), regardless of spend", async () => {
    const { getUserCostUsdSince } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(1000);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getUserCostUsdSince).not.toHaveBeenCalled();
  });

  it("skips the provider call and returns null once today's spend reaches the cap", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getUserCostUsdSince, insertLlmUsage } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(1);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { feature: "cv-review" });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(insertLlmUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: "cv-review", outcome: "budget_exceeded" }));
  });

  it("still calls the provider when spend is below the cap", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getUserCostUsdSince } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(0.5);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fails open (still calls the provider) when the telemetry read itself fails", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getUserCostUsdSince } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not block a cache hit even when today's spend has already reached the cap", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getLlmCache } = await import("../db/llm-cache.js");
    vi.mocked(getLlmCache).mockResolvedValueOnce({ value: "cached answer" });
    const { getUserCostUsdSince } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(1);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { cache: true });
    expect(result).toBe("cached answer");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getUserCostUsdSince).not.toHaveBeenCalled();
  });

  // Degrade, don't cut off: a "smart"-tier request that hits the cap should still go out, just on
  // the cheaper "fast" model — only a request that was ALREADY "fast" (nothing cheaper left) is
  // still a hard cutoff (covered by "skips the provider call..." above).
  it("downgrades a smart-tier request to the fast model instead of blocking it, once the cap is reached", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getUserCostUsdSince, insertLlmUsage } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(1);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart", feature: "cv-review" });
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // OPENAI_MODEL (fast) is gpt-4o-mini, OPENAI_MODEL_SMART (smart) is gpt-5 (config/env.ts
    // defaults) — the actual request body must carry the downgraded (fast) model, not the smart one.
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.model).toBe("gpt-4o-mini");
    // The final telemetry row reflects the tier the call actually ran at (fast), and a normal
    // "success" outcome — this isn't the "budget_exceeded" cutoff outcome, since the call went through.
    expect(insertLlmUsage).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "cv-review", tier: "fast", model: "gpt-4o-mini", outcome: "success" }),
    );
  });

  it("caches the downgraded call's result under the fast-tier cache key, not the originally-requested smart-tier key", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    const { getUserCostUsdSince } = await import("../telemetry/telemetry.repo.js");
    vi.mocked(getUserCostUsdSince).mockResolvedValue(1);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
    const { setLlmCache } = await import("../db/llm-cache.js");
    const { hashString } = await import("../shared/hash.js");
    const { chat } = await import("./client.js");
    await chat(BOOTSTRAP_USER_ID, "system", "user", { tier: "smart", cache: true });
    const expectedFastKey = "llm:" + hashString(["fast", "text", "system", "user"].join("|"));
    const expectedSmartKey = "llm:" + hashString(["smart", "text", "system", "user"].join("|"));
    expect(setLlmCache).toHaveBeenCalledWith(expectedFastKey, { value: "ok" });
    expect(setLlmCache).not.toHaveBeenCalledWith(expectedSmartKey, expect.anything());
  });
});

// The Free-plan monthly AI-call quota (modules/billing/entitlements.ts#getAiQuotaState),
// mirroring the "chat() daily cost cap" describe block above: same setup, same fail-open
// contract, but gated on env.billing.isAvailable (all three STRIPE_* vars) rather than
// env.llm.dailyCostCapUsd, and layered BEFORE it — see llm/client.ts's comment at the call site.
describe("chat() plan quota", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockOkFetch() {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }),
    } as Response);
  }

  it("calls the provider normally, with no entitlement read at all, when billing is unconfigured (default)", async () => {
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    const fetchSpy = mockOkFetch();
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getAiQuotaState).not.toHaveBeenCalled();
  });

  it("skips the provider call and returns null once the Free-plan monthly quota is reached", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_x");
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    vi.mocked(getAiQuotaState).mockResolvedValue({ allowed: false, used: 20, limit: 20, resetsAt: "2026-07-01T00:00:00.000Z" });
    const { insertLlmUsage } = await import("../telemetry/telemetry.repo.js");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { feature: "cv-review" });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(insertLlmUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: "cv-review", outcome: "quota_exceeded" }));
  });

  it("sets the request-context aiQuotaExceeded flag so app.ts can attach the advisory header", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_x");
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    vi.mocked(getAiQuotaState).mockResolvedValue({ allowed: false, used: 20, limit: 20, resetsAt: null });
    const { chat } = await import("./client.js");
    const { runWithRequestContext, wasAiQuotaExceeded } = await import("../core/request-context.js");
    const exceeded = await runWithRequestContext("req-1", "en", async () => {
      await chat(BOOTSTRAP_USER_ID, "system", "user");
      return wasAiQuotaExceeded();
    });
    expect(exceeded).toBe(true);
  });

  it("still calls the provider when under the quota", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_x");
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    vi.mocked(getAiQuotaState).mockResolvedValue({ allowed: true, used: 19, limit: 20, resetsAt: "2026-07-01T00:00:00.000Z" });
    const fetchSpy = mockOkFetch();
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("calls the provider unconditionally for a Pro/Team plan (unlimited, limit: null)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_x");
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    vi.mocked(getAiQuotaState).mockResolvedValue({ allowed: true, used: 0, limit: null, resetsAt: null });
    const fetchSpy = mockOkFetch();
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fails open (still calls the provider) when the entitlement/quota read itself throws", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_x");
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    vi.mocked(getAiQuotaState).mockRejectedValue(new Error("db unreachable"));
    const fetchSpy = mockOkFetch();
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user");
    expect(result).toBe("ok");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not consult the quota at all for a cache hit", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_x");
    const { getLlmCache } = await import("../db/llm-cache.js");
    vi.mocked(getLlmCache).mockResolvedValueOnce({ value: "cached answer" });
    const { getAiQuotaState } = await import("../modules/billing/entitlements.js");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat(BOOTSTRAP_USER_ID, "system", "user", { cache: true });
    expect(result).toBe("cached answer");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getAiQuotaState).not.toHaveBeenCalled();
  });
});

// chatJson(): chat() in json mode + zod validation + one self-repair retry — replaces the manual
// typeof/Array.isArray parsing that used to be duplicated in ~11 places across the server.
describe("chatJson()", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the parsed+typed data on the first attempt when it already matches the schema", async () => {
    const { z } = await import("zod");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"score":80}' }, finish_reason: "stop" }] }),
    } as Response);
    const { chatJson } = await import("./client.js");
    const schema = z.object({ score: z.number() });
    const result = await chatJson(BOOTSTRAP_USER_ID, "system", "user", schema);
    expect(result).toEqual({ score: 80 });
  });

  it("retries once with a repair prompt describing the validation errors when the first response fails schema validation", async () => {
    const { z } = await import("zod");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // First attempt: "score" is a string instead of a number (a typical LLM output error).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"score":"eighty"}' }, finish_reason: "stop" }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"score":80}' }, finish_reason: "stop" }] }),
      } as Response);
    const { chatJson } = await import("./client.js");
    const schema = z.object({ score: z.number() });
    const result = await chatJson(BOOTSTRAP_USER_ID, "system", "user", schema);
    expect(result).toEqual({ score: 80 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(String(fetchSpy.mock.calls[1]![1]?.body));
    expect(repairBody.messages[1].content).toMatch(/did NOT match the required structure/);
  });

  it("returns null when the repair retry ALSO fails schema validation", async () => {
    const { z } = await import("zod");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"score":"eighty"}' }, finish_reason: "stop" }] }),
    } as Response);
    const { chatJson } = await import("./client.js");
    const schema = z.object({ score: z.number() });
    const result = await chatJson(BOOTSTRAP_USER_ID, "system", "user", schema);
    expect(result).toBeNull();
  });

  it("returns null without attempting a repair retry when the provider itself returns null (offline/error)", async () => {
    const { z } = await import("zod");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
    } as Response);
    const { chatJson } = await import("./client.js");
    const schema = z.object({ score: z.number() });
    const result = await chatJson(BOOTSTRAP_USER_ID, "system", "user", schema);
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no repair call at all when there's no base result to begin with
  });
});
