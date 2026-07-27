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
