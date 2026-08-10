// Telegram Bot API via raw `fetch` — no SDK, same no-SDK stance as shared/email.ts's Resend call
// and llm/client.ts's OpenAI/Anthropic calls. Gated behind TELEGRAM_BOT_TOKEN, same graceful-
// offline-fallback shape as every other optional provider in this app: without one, a message is
// logged instead of sent.
//
// Deliberately DB-free (transport only): it reports a dead chat back to its caller rather than
// unlinking one itself, so shared/notify.ts owns every decision that touches storage. That's what
// keeps this module — and its unit tests — free of a Postgres connection, the same split
// core/http.ts makes for its lazy auth import.
import { env } from "../config/env.js";
import { contextLogger } from "../core/logger.js";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * - `sent` — the Bot API accepted it.
 * - `skipped` — no bot configured; the message was logged instead (offline fallback).
 * - `blocked` — this chat is permanently gone (user blocked the bot / deleted the chat). The
 *   caller must drop the stored link: nothing about retrying later can fix it, and without this
 *   the schedulers would re-send to a dead chat on every tick, forever.
 * - `failed` — anything else (transient 5xx, a network error, rate limiting). Worth retrying on
 *   the next tick, so the link stays.
 */
export type TelegramSendResult = "sent" | "skipped" | "blocked" | "failed";

/** One inline-keyboard button. `callbackData` is capped at 64 BYTES by the Bot API — build it from
 * short opaque tokens (see modules/telegram/telegram.callbacks.ts), never a URL or a label. */
export interface TelegramButton {
  text: string;
  callbackData: string;
}

export interface SendOptions {
  /** Rows of inline buttons rendered under the message. */
  buttons?: TelegramButton[][];
}

// 403 is the documented "bot was blocked by the user" / "user is deactivated" status. 400 is
// overloaded (it's also plain malformed input), so it only counts as dead when the description
// actually says the chat is gone — otherwise a bug in our own payload would silently unlink users.
function isDeadChat(status: number, body: string): boolean {
  if (status === 403) return true;
  return status === 400 && /chat not found|user is deactivated|chat_id is empty/i.test(body);
}

async function callBotApi(method: string, payload: unknown): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${env.telegram.botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = res.ok ? "" : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

/** @param text Plain text — never HTML/Markdown. Telegram's `parse_mode: "HTML"` only accepts a
 * narrow tag subset (b/i/a/code/pre, none of the <ul>/<li>/<p> this app's email templates use),
 * so callers render a plain-text message (see modules/notifications/notifications.service.ts and
 * modules/digest/digest.service.ts#digestText) rather than reusing the HTML email body. */
export async function sendTelegramMessage(chatId: string, text: string, options: SendOptions = {}): Promise<TelegramSendResult> {
  if (!env.telegram.isAvailable) {
    contextLogger().info({ chatId, text }, "Telegram bot not configured — logging instead of sending");
    return "skipped";
  }
  const { ok, status, body } = await callBotApi("sendMessage", {
    chat_id: chatId,
    text,
    ...(options.buttons?.length
      ? {
          reply_markup: {
            inline_keyboard: options.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.callbackData }))),
          },
        }
      : {}),
  });
  if (ok) return "sent";
  // Never throw: a failed Telegram send shouldn't break the scheduler run it's part of — the
  // rest of that batch (other users, the email that may have already gone out) must proceed.
  contextLogger().error({ status, body: body.slice(0, 500), chatId }, "Failed to send Telegram message");
  return isDeadChat(status, body) ? "blocked" : "failed";
}

/** Every callback_query MUST be answered, even with nothing to say — until it is, Telegram leaves
 * a loading spinner on the tapped button in the user's client. Fire-and-forget by design: failing
 * to clear a spinner must never fail the action the button actually triggered. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!env.telegram.isAvailable) return;
  const { ok, status, body } = await callBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
  if (!ok) contextLogger().error({ status, body: body.slice(0, 500) }, "Failed to answer Telegram callback query");
}

/** Rewrites an already-sent message in place — used after an inline button is tapped, so the
 * notification itself becomes the receipt ("Status → Applied") instead of the buttons staying live
 * on a stale message. Passing no `buttons` clears the keyboard, which is the point. */
export async function editTelegramMessage(chatId: string, messageId: number, text: string, options: SendOptions = {}): Promise<void> {
  if (!env.telegram.isAvailable) {
    contextLogger().info({ chatId, messageId, text }, "Telegram bot not configured — logging instead of editing");
    return;
  }
  const { ok, status, body } = await callBotApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: {
      inline_keyboard: options.buttons?.length
        ? options.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.callbackData })))
        : [],
    },
  });
  if (!ok) contextLogger().error({ status, body: body.slice(0, 500), chatId }, "Failed to edit Telegram message");
}

export interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
  /** An inline button tap. Carries its own `from`/`message` rather than reusing `message` above —
   * `message` here is the ALREADY-SENT notification being acted on, not something the user typed. */
  callback_query?: {
    id?: string;
    data?: string;
    message?: {
      message_id?: number;
      chat?: { id?: number | string };
    };
  };
}
