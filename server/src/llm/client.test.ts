// Contract-тести офлайн-фолбеку LLM-клієнта: незалежно від того, що просить викликач,
// без сконфігурованого ключа провайдера `chat()` МАЄ повертати null, а не кидати виняток
// чи намагатись достукатись до мережі. Це основний контракт, на який покладаються всі
// сервіси (writing, knowledge, cv-analysis тощо) для graceful-деградації без API-ключа.
//
// process.env стабиться на undefined (а не "") — порожній рядок не проходить
// `.trim().min(1).optional()` у config/env.ts і завалить процес валідації (той самий
// нюанс, що й у playwright.config.ts для e2e). vi.resetModules() + динамічний import
// потрібні, бо env.ts читає process.env один раз при імпорті (модуль кешується).
//
// db/index.js мокнуто, бо client.ts імпортує звідти getKvJson/setKvJson лише для
// опційного кешу відповідей — реальний модуль тягне node:sqlite, який vite/vitest не
// вміє трансформувати при динамічному реімпорті (тест мусить лишатись ізольованим від БД).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({
  getKvJson: vi.fn(() => null),
  setKvJson: vi.fn(),
}));

describe("chat() / llmAvailable() offline fallback", () => {
  beforeAll(async () => {
    // "dotenv/config" — зовнішній пакет (не файл з src/), тож vi.resetModules() не чіпає
    // його кеш: side-effect (заповнення process.env) виконується лише ОДИН РАЗ за час
    // життя процесу. Прогріваємо його тут, до першого vi.stubEnv нижче — інакше перший
    // dynamic import у тестах спровокує відкладений dotenv.config(), який перезапише щойно
    // видалену змінну реальним значенням із server/.env.
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
    const result = await chat("system prompt", "user prompt");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("chat() resolves to null in json mode without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { chat } = await import("./client.js");
    const result = await chat<{ focus: string }>("system prompt", "user prompt", { json: true });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// Регресія: провайдер, що відповідає НЕ-2xx статусом (недійсний ключ, rate limit, тимчасова
// помилка), раніше не перевірявся через r.ok — callProvider тихо намагався прочитати тіло помилки
// як успішну відповідь (d?.choices?.[0]?.message?.content не існує → text=""), і викликачі
// (reviewCv/matchCv тощо) не могли відрізнити "провайдер повернув помилку" від "легітимної
// порожньої відповіді" — обидва варіанти виглядали як null без жодного логу причини.
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
    // 429 — retryable, тож mockResolvedValue (без .Once) означає, що ОБИДВІ спроби (оригінал +
    // 1 retry) отримають той самий 429 — і в результаті все одно null, а не виняток.
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat("system", "user");
    expect(result).toBeNull();
  });

  it("returns null in json mode when the response is HTTP-ok but truncated/invalid JSON", async () => {
    // Симулює найпоширенішу причину мовчазного провалу: генерація обірвалась по maxTokens
    // ДО завершення JSON (response_format:json_object гарантує валідність лише БЕЗ обриву) —
    // HTTP 200/ok, тож r.ok-перевірка це не ловить, і раніше це виглядало як звичайний null.
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"score":80,"summary":"Незакінчений рядок обірваний посере' }, finish_reason: "length" }],
      }),
    } as Response);
    const { chat } = await import("./client.js");
    const result = await chat<{ score: number }>("system", "user", { json: true });
    expect(result).toBeNull();
  });

  it("retries once on a transient 429 and succeeds if the second attempt is ok", async () => {
    // Симулює короткочасне перевантаження провайдера: перша спроба 429, друга — успішна.
    // callProvider() має розпізнати 429 як "варте повтору" і зробити РІВНО один retry.
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
    const result = await chat("system", "user");
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
    const result = await chat("system", "user");
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
    const result = await chat<{ score: number; summary: string }>("system", "user", { json: true });
    expect(result).toEqual({ score: 80, summary: "ok" });
  });
});

// Регресія/фіча: раніше client.ts мав жорстко один провайдер (env.LLM_PROVIDER) — короткочасний
// outage/rate-limit цього ЄДИНОГО провайдера клав усі AI-фічі в офлайн, навіть якщо власник
// випадково мав налаштований і ДРУГИЙ ключ. Тепер, якщо задано ОБИДВА ключі, primary-провайдер,
// що повністю провалився (після власної спроби+retry), автоматично пробується через secondary.
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
    vi.restoreAllMocks();
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
    const result = await chat("system", "user");
    expect(result).toBe("answer from anthropic");
    // openai: 1 виклик (401 не retryable, без внутрішнього retry) + anthropic: 1 виклик = 2 всього.
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
    const result = await chat("system", "user");
    expect(result).toBe("answer from anthropic");
    // openai: 2 виклики (оригінал + 1 retry на 429) + anthropic: 1 виклик = 3 всього.
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
    const result = await chat("system", "user");
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
    const result = await chat("system", "user");
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2); // одна спроба на кожного (обидва 401 — не retryable)
  });
});

// Видимість вартості: нормалізація usage-полів провайдера (prompt_tokens/completion_tokens
// для OpenAI, input_tokens/output_tokens для Anthropic) в ОДНУ форму для логів/агрегації.
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

// chatJson(): chat() у json-режимі + zod-валідація + один self-repair retry — заміняє ручний
// typeof/Array.isArray-розбір, що раніше дублювався в ~11 місцях по всьому серверу.
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
    vi.restoreAllMocks();
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
    const result = await chatJson("system", "user", schema);
    expect(result).toEqual({ score: 80 });
  });

  it("retries once with a repair prompt describing the validation errors when the first response fails schema validation", async () => {
    const { z } = await import("zod");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // Перша спроба: "score" — рядок замість числа (типова помилка LLM-виводу).
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
    const result = await chatJson("system", "user", schema);
    expect(result).toEqual({ score: 80 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(String(fetchSpy.mock.calls[1]![1]?.body));
    expect(repairBody.messages[1].content).toMatch(/відповідала потрібній структурі/);
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
    const result = await chatJson("system", "user", schema);
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
    const result = await chatJson("system", "user", schema);
    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1); // жоден repair-виклик, коли базового результату взагалі немає
  });
});
