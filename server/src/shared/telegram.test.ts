// Unlike shared/email.ts (exercised indirectly through real e2e signup/reset flows), nothing in
// this app's e2e suite ever configures TELEGRAM_BOT_TOKEN — this is the only place
// sendTelegramMessage()'s actual behavior gets checked at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLog = { info: vi.fn(), error: vi.fn() };
vi.mock("../core/logger.js", () => ({ contextLogger: () => mockLog }));

describe("sendTelegramMessage()", () => {
  beforeEach(() => {
    vi.resetModules();
    mockLog.info.mockReset();
    mockLog.error.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("logs instead of sending when the bot is not configured (default)", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", undefined);
    vi.stubEnv("TELEGRAM_BOT_USERNAME", undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendTelegramMessage } = await import("./telegram.js");
    await sendTelegramMessage("12345", "hello");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ chatId: "12345" }), expect.stringContaining("not configured"));
    fetchSpy.mockRestore();
  });

  it("POSTs to the Bot API's sendMessage endpoint when configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "zorya_bot");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const { sendTelegramMessage } = await import("./telegram.js");
    await sendTelegramMessage("12345", "hello");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ chat_id: "12345", text: "hello" }) }),
    );
    fetchSpy.mockRestore();
  });

  it("logs an error (never throws) when the Bot API responds with a non-2xx status", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "zorya_bot");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve("Forbidden: bot was blocked by the user") } as Response);
    const { sendTelegramMessage } = await import("./telegram.js");
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBeUndefined();
    expect(mockLog.error).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }), expect.stringContaining("Failed to send"));
    fetchSpy.mockRestore();
  });
});
