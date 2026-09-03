// env.llm.isAvailable — regression test: it used to check "is ANY key present" regardless
// of LLM_PROVIDER, so LLM_PROVIDER=openai (default) with only ANTHROPIC_API_KEY set in .env
// was considered "available", while llm/client.ts still went down the OpenAI branch with
// `Bearer undefined` — every request silently failed. Now isAvailable is tied to the
// specifically selected provider.
//
// vi.resetModules() + dynamic import — env.ts reads process.env once at import time
// (the same approach used in llm/client.test.ts).
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

// The Telegram webhook (telegram.routes.ts) has no session — an unset TELEGRAM_WEBHOOK_SECRET
// leaves the webhook URL as the only thing standing between the internet and
// resolveLinkToken()/applyStatusChange(), and a chat_id isn't secret. Not enforced (a self-hosted
// deployment that registered its webhook before the secret existed must keep working), but it
// must warn at startup the same way an LLM misconfiguration does.
describe("Telegram webhook secret startup warning", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", undefined);
    vi.stubEnv("TELEGRAM_BOT_USERNAME", undefined);
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("warns when Telegram is enabled but no webhook secret is set", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "zorya_bot");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./env.js");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("TELEGRAM_WEBHOOK_SECRET"));
    warnSpy.mockRestore();
  });

  it("does not warn when Telegram is enabled and a webhook secret is set", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "zorya_bot");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "shh");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./env.js");
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("TELEGRAM_WEBHOOK_SECRET"));
    warnSpy.mockRestore();
  });

  it("does not warn when Telegram is not configured at all", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./env.js");
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("TELEGRAM_WEBHOOK_SECRET"));
    warnSpy.mockRestore();
  });
});
