// env.llm.isAvailable — регресія: раніше перевіряв "чи є БУДЬ-ЯКИЙ ключ" незалежно від
// LLM_PROVIDER, тож LLM_PROVIDER=openai (дефолт) з лише ANTHROPIC_API_KEY у .env вважався
// "доступним", а llm/client.ts все одно йшов у гілку OpenAI з `Bearer undefined` — кожен
// запит тихо провалювався. Тепер isAvailable прив'язаний саме до вибраного провайдера.
//
// vi.resetModules() + динамічний import — env.ts читає process.env один раз при імпорті
// (той самий підхід, що в llm/client.test.ts).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("env.llm.isAvailable", () => {
  beforeAll(async () => {
    await import("dotenv/config");
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("LLM_PROVIDER", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when no key is configured at all", async () => {
    const { env } = await import("./env.js");
    expect(env.llm.isAvailable).toBe(false);
  });

  it("is true when provider is openai (default) and OPENAI_API_KEY is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { env } = await import("./env.js");
    expect(env.llm.isAvailable).toBe(true);
  });

  it("is true when provider is anthropic and ANTHROPIC_API_KEY is set", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const { env } = await import("./env.js");
    expect(env.llm.isAvailable).toBe(true);
  });

  it("is FALSE when provider is openai (default) but only ANTHROPIC_API_KEY is set — the misconfiguration bug", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const { env } = await import("./env.js");
    expect(env.llm.isAvailable).toBe(false);
  });

  it("is FALSE when provider is anthropic but only OPENAI_API_KEY is set — the mirror case", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { env } = await import("./env.js");
    expect(env.llm.isAvailable).toBe(false);
  });

  it("is true when provider is openai and BOTH keys happen to be set (own key present is what matters)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const { env } = await import("./env.js");
    expect(env.llm.isAvailable).toBe(true);
  });
});
