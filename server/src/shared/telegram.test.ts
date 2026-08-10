// Unlike shared/email.ts (exercised indirectly through real e2e signup/reset flows), nothing in
// this app's e2e suite ever configures TELEGRAM_BOT_TOKEN — this is the only place
// sendTelegramMessage()'s actual behavior gets checked at all.
//
// The bot's configured/unconfigured state is set by MOCKING config/env.js, not by stubbing the
// underlying environment variable. That module does `import "dotenv/config"`, so with
// vi.resetModules() between cases every re-import re-reads server/.env — meaning an env stub is
// immediately undone by dotenv on a developer machine that has a real token in its .env, and the
// "not configured" case would quietly POST to the LIVE Telegram API instead of taking the offline
// branch. Mocking the env module is the only way to make these deterministic.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLog = { info: vi.fn(), error: vi.fn() };
vi.mock("../core/logger.js", () => ({ contextLogger: () => mockLog }));

async function loadTelegram(isAvailable: boolean) {
  vi.resetModules();
  vi.doMock("../config/env.js", () => ({
    env: { telegram: { isAvailable, botToken: "test-token", botUsername: "zorya_bot", webhookSecret: null } },
  }));
  return import("./telegram.js");
}

describe("sendTelegramMessage()", () => {
  beforeEach(() => {
    mockLog.info.mockReset();
    mockLog.error.mockReset();
  });
  afterEach(() => {
    vi.doUnmock("../config/env.js");
    vi.restoreAllMocks();
  });

  it("logs instead of sending when the bot is not configured (default)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { sendTelegramMessage } = await loadTelegram(false);
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBe("skipped");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith(expect.objectContaining({ chatId: "12345" }), expect.stringContaining("not configured"));
  });

  it("POSTs to the Bot API's sendMessage endpoint when configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const { sendTelegramMessage } = await loadTelegram(true);
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBe("sent");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ chat_id: "12345", text: "hello" }) }),
    );
  });

  it("reports a 403 as `blocked` (never throws) so the caller can drop the dead link", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden: bot was blocked by the user"),
    } as Response);
    const { sendTelegramMessage } = await loadTelegram(true);
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBe("blocked");
    expect(mockLog.error).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }), expect.stringContaining("Failed to send"));
  });

  // The distinction that matters: a transient failure must leave the link alone, or one upstream
  // outage would silently unlink every user the scheduler touched during it.
  it("reports a 500 as `failed`, not `blocked`", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as Response);
    const { sendTelegramMessage } = await loadTelegram(true);
    await expect(sendTelegramMessage("12345", "hello")).resolves.toBe("failed");
  });

  // 400 is overloaded — it's also what a malformed payload of OUR OWN returns, so only the
  // "chat is gone" descriptions may unlink.
  it("treats a 400 as `blocked` only when the description says the chat is gone", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request: chat not found"),
    } as Response);
    const gone = await loadTelegram(true);
    await expect(gone.sendTelegramMessage("12345", "hello")).resolves.toBe("blocked");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request: message text is empty"),
    } as Response);
    const ourBug = await loadTelegram(true);
    await expect(ourBug.sendTelegramMessage("12345", "hello")).resolves.toBe("failed");
  });

  it("sends an inline keyboard when buttons are given", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const { sendTelegramMessage } = await loadTelegram(true);
    await sendTelegramMessage("12345", "hello", { buttons: [[{ text: "Applied", callbackData: "v:1:a" }]] });
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.reply_markup).toEqual({ inline_keyboard: [[{ text: "Applied", callback_data: "v:1:a" }]] });
  });
});
