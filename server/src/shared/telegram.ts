// Telegram Bot API via raw `fetch` — no SDK, same no-SDK stance as shared/email.ts's Resend call
// and llm/client.ts's OpenAI/Anthropic calls. Gated behind TELEGRAM_BOT_TOKEN, same graceful-
// offline-fallback shape as every other optional provider in this app: without one, a message is
// logged instead of sent.
import { env } from "../config/env.js";
import { contextLogger } from "../core/logger.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/** @param text Plain text — never HTML/Markdown. Telegram's `parse_mode: "HTML"` only accepts a
 * narrow tag subset (b/i/a/code/pre, none of the <ul>/<li>/<p> this app's email templates use),
 * so callers render a plain-text message (see modules/digest/digest.service.ts#digestText and
 * modules/saved-searches/saved-searches.scheduler.ts#digestText) rather than reusing the HTML
 * email body. */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!env.telegram.isAvailable) {
    contextLogger().info({ chatId, text }, "Telegram bot not configured — logging instead of sending");
    return;
  }
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${env.telegram.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Never throw: a failed Telegram send shouldn't break the scheduler run it's part of — the
    // rest of that batch (other users, the email that may have already gone out) must proceed.
    contextLogger().error({ status: res.status, body: body.slice(0, 500), chatId }, "Failed to send Telegram message");
  }
}

export interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
}
