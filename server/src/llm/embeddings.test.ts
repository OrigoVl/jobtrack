// The same contract pattern as in client.test.ts: without an OpenAI key (or with the anthropic
// provider — embeddings aren't implemented for it here), embeddingsAvailable()/embed()/semanticSimilarity()
// MUST return false/null instead of throwing or reaching the network — the graceful degradation that
// quickAnalyze() relies on (semanticFit becomes null, tech-based fit remains the main signal).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../db/user-id.js";

vi.mock("../db/llm-cache.js", () => ({
  getLlmCache: vi.fn(() => null),
  setLlmCache: vi.fn(),
}));
// telemetry.repo.js lazily imports db/client.js only when actually invoked (see its own doc
// comment) precisely so tests like this one don't need a real Postgres connection — but
// embed()'s success/error paths DO call insertLlmUsage(), so we still stub it out here rather
// than let a real (fire-and-forget, harmlessly-failing) DB call happen during a unit test.
vi.mock("../telemetry/telemetry.repo.js", () => ({
  insertLlmUsage: vi.fn(),
  insertProductEvent: vi.fn(),
}));

describe("embeddingsAvailable() / embed() — offline / non-openai fallback", () => {
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

  it("is unavailable without any provider key configured", async () => {
    const { embeddingsAvailable } = await import("./embeddings.js");
    expect(embeddingsAvailable()).toBe(false);
  });

  it(
    "is unavailable when the configured provider is anthropic, even with a key set — " +
      "there is no public embeddings API for anthropic wired up here",
    async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
      vi.stubEnv("LLM_PROVIDER", "anthropic");
      const { embeddingsAvailable } = await import("./embeddings.js");
      expect(embeddingsAvailable()).toBe(false);
    },
  );

  it("embed() resolves to null without calling the network when unavailable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { embed } = await import("./embeddings.js");
    expect(await embed(BOOTSTRAP_USER_ID, "some CV text")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("semanticSimilarity() resolves to null (not 0) when embeddings are unavailable", async () => {
    const { semanticSimilarity } = await import("./embeddings.js");
    expect(await semanticSimilarity(BOOTSTRAP_USER_ID, "a", "b")).toBeNull();
  });
});

describe("embed() / semanticSimilarity() — with an OpenAI key configured", () => {
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

  it("returns the embedding vector from a successful API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [1, 0, 0] }] }),
    } as Response);
    const { embed } = await import("./embeddings.js");
    expect(await embed(BOOTSTRAP_USER_ID, "some CV text")).toEqual([1, 0, 0]);
  });

  it("returns null (not a thrown error) when the provider responds with a non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
    } as Response);
    const { embed } = await import("./embeddings.js");
    expect(await embed(BOOTSTRAP_USER_ID, "some CV text")).toBeNull();
  });

  it("returns null for an empty/whitespace-only input without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { embed } = await import("./embeddings.js");
    expect(await embed(BOOTSTRAP_USER_ID, "   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("computes a high semantic similarity for two near-identical vectors and a low one for orthogonal vectors", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      const vector = body.input.includes("orthogonal-b") ? [0, 1, 0] : [1, 0, 0];
      return { ok: true, status: 200, json: async () => ({ data: [{ embedding: vector }] }) } as Response;
    });
    const { semanticSimilarity } = await import("./embeddings.js");
    expect(await semanticSimilarity(BOOTSTRAP_USER_ID, "same text", "same text")).toBeCloseTo(1, 5);
    expect(await semanticSimilarity(BOOTSTRAP_USER_ID, "same text", "orthogonal-b")).toBeCloseTo(0, 5);
  });
});

describe("cosineSimilarity()", () => {
  it("is 1 for identical vectors", async () => {
    const { cosineSimilarity } = await import("./embeddings.js");
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("is 0 for orthogonal vectors", async () => {
    const { cosineSimilarity } = await import("./embeddings.js");
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("is 0 for mismatched-length or empty vectors instead of throwing", async () => {
    const { cosineSimilarity } = await import("./embeddings.js");
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});
