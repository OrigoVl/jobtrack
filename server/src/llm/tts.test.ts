// Contract tests for the TTS client's graceful degradation: ttsAvailable() is OpenAI-key-specific
// (unlike llmAvailable(), it must be false even when LLM_PROVIDER="anthropic" with only
// ANTHROPIC_API_KEY set — Anthropic has no TTS product), and synthesizeSpeech() must NEVER throw,
// falling back to null (→ the caller falls back to the browser's Web Speech API) whenever TTS is
// unavailable, the user is already over their daily $ cap, or the API call itself fails.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../db/user-id.js";
import * as telemetryRepo from "../telemetry/telemetry.repo.js";

// telemetry.repo.js lazily imports db/client.js only when actually invoked (see its own doc
// comment) precisely so this test doesn't need a real Postgres connection — but
// synthesizeSpeech()'s cap-check and success/error paths DO call getUserCostUsdSince()/
// insertLlmUsage(), so we stub both out here rather than let a real (fire-and-forget) DB call
// happen during a unit test.
vi.mock("../telemetry/telemetry.repo.js", () => ({
  insertLlmUsage: vi.fn(),
  getUserCostUsdSince: vi.fn(() => Promise.resolve(0)),
}));
const insertLlmUsage = vi.mocked(telemetryRepo.insertLlmUsage);
const getUserCostUsdSince = vi.mocked(telemetryRepo.getUserCostUsdSince);

describe("ttsAvailable()", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is false without OPENAI_API_KEY configured", async () => {
    const { ttsAvailable } = await import("./tts.js");
    expect(ttsAvailable()).toBe(false);
  });

  it(
    "is false when OPENAI_API_KEY is unset even if ANTHROPIC_API_KEY and LLM_PROVIDER=anthropic are set — " +
      "unlike llmAvailable(), TTS specifically requires the OpenAI key regardless of the selected provider",
    async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("LLM_PROVIDER", "anthropic");
      const { ttsAvailable } = await import("./tts.js");
      expect(ttsAvailable()).toBe(false);
    },
  );

  it("is true when OPENAI_API_KEY is configured, regardless of LLM_PROVIDER", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    const { ttsAvailable } = await import("./tts.js");
    expect(ttsAvailable()).toBe(true);
  });
});

describe("synthesizeSpeech() — offline fallback", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    insertLlmUsage.mockClear();
    getUserCostUsdSince.mockClear().mockResolvedValue(0);
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("resolves to null without calling the network when unavailable (no OpenAI key)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { synthesizeSpeech } = await import("./tts.js");
    expect(await synthesizeSpeech(BOOTSTRAP_USER_ID, "Tell me about yourself.")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves to null for empty/whitespace-only input without calling the network", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { synthesizeSpeech } = await import("./tts.js");
    expect(await synthesizeSpeech(BOOTSTRAP_USER_ID, "   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("synthesizeSpeech() — with an OpenAI key configured", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    insertLlmUsage.mockClear();
    getUserCostUsdSince.mockClear().mockResolvedValue(0);
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", "openai");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("skips the network call and returns null when the user is already over the daily cost cap", async () => {
    vi.stubEnv("LLM_DAILY_COST_CAP_USD", "1");
    getUserCostUsdSince.mockResolvedValue(5); // already well over the $1 cap
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { synthesizeSpeech } = await import("./tts.js");
    expect(await synthesizeSpeech(BOOTSTRAP_USER_ID, "Tell me about yourself.")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the mp3 buffer and records a success telemetry row with cost = chars/1e6 * $12 on a successful response", async () => {
    const text = "Tell me about a challenge you faced."; // 38 chars
    const fakeAudioBytes = new Uint8Array([1, 2, 3, 4]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => fakeAudioBytes.buffer,
    } as unknown as Response);
    const { synthesizeSpeech } = await import("./tts.js");
    const result = await synthesizeSpeech(BOOTSTRAP_USER_ID, text);
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.equals(Buffer.from(fakeAudioBytes))).toBe(true);
    expect(insertLlmUsage).toHaveBeenCalledTimes(1);
    const call = insertLlmUsage.mock.calls[0]?.[0];
    expect(call?.outcome).toBe("success");
    expect(call?.feature).toBe("voice-tts");
    expect(call?.model).toBe("gpt-4o-mini-tts");
    expect(call?.costUsd).toBeCloseTo((text.length / 1_000_000) * 12, 10);
  });

  it("returns null (not a thrown error) and records an error telemetry row when the provider responds with a non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: { message: "Internal server error" } }),
    } as Response);
    const { synthesizeSpeech } = await import("./tts.js");
    expect(await synthesizeSpeech(BOOTSTRAP_USER_ID, "Tell me about yourself.")).toBeNull();
    expect(insertLlmUsage).toHaveBeenCalledTimes(1);
    expect(insertLlmUsage.mock.calls[0]?.[0]?.outcome).toBe("error");
  });

  it("returns null (not a thrown error) when the fetch call itself throws (network error/timeout)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { synthesizeSpeech } = await import("./tts.js");
    expect(await synthesizeSpeech(BOOTSTRAP_USER_ID, "Tell me about yourself.")).toBeNull();
    expect(insertLlmUsage).toHaveBeenCalledTimes(1);
    expect(insertLlmUsage.mock.calls[0]?.[0]?.outcome).toBe("error");
  });
});
