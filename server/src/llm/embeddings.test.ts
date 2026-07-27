// Той самий контракт-паттерн, що й у client.test.ts: без OpenAI-ключа (або з провайдером
// anthropic — embeddings тут не реалізовані) embeddingsAvailable()/embed()/semanticSimilarity()
// МАЮТЬ повертати false/null, а не кидати чи стукатись у мережу — graceful-деградація, на яку
// покладається quickAnalyze() (semanticFit стає null, tech-based fit лишається основним сигналом).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({
  getKvJson: vi.fn(() => null),
  setKvJson: vi.fn(),
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
    expect(await embed("some CV text")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("semanticSimilarity() resolves to null (not 0) when embeddings are unavailable", async () => {
    const { semanticSimilarity } = await import("./embeddings.js");
    expect(await semanticSimilarity("a", "b")).toBeNull();
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
    expect(await embed("some CV text")).toEqual([1, 0, 0]);
  });

  it("returns null (not a thrown error) when the provider responds with a non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: "Invalid API key" } }),
    } as Response);
    const { embed } = await import("./embeddings.js");
    expect(await embed("some CV text")).toBeNull();
  });

  it("returns null for an empty/whitespace-only input without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { embed } = await import("./embeddings.js");
    expect(await embed("   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("computes a high semantic similarity for two near-identical vectors and a low one for orthogonal vectors", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      const vector = body.input.includes("orthogonal-b") ? [0, 1, 0] : [1, 0, 0];
      return { ok: true, status: 200, json: async () => ({ data: [{ embedding: vector }] }) } as Response;
    });
    const { semanticSimilarity } = await import("./embeddings.js");
    expect(await semanticSimilarity("same text", "same text")).toBeCloseTo(1, 5);
    expect(await semanticSimilarity("same text", "orthogonal-b")).toBeCloseTo(0, 5);
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
