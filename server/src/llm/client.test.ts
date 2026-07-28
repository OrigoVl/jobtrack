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
