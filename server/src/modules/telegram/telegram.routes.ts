import express from "express";
import { authed, asyncHandler, HttpError } from "../../core/http.js";
import { contextLogger } from "../../core/logger.js";
import { env } from "../../config/env.js";
import { answerCallbackQuery, editTelegramMessage, sendTelegramMessage, type TelegramUpdate } from "../../shared/telegram.js";
import { decodeCallback, vacancyButtons } from "./telegram.callbacks.js";
import { applyStatusChange, enrichAddedVacancy, handleCommand, HELP_TEXT } from "./telegram.commands.js";
import {
  clearTelegramChatId,
  createLinkToken,
  getTelegramChatId,
  getUserIdByChatId,
  resolveLinkToken,
  setTelegramChatId,
} from "./telegram.repo.js";

const r = express.Router();

r.get(
  "/telegram/status",
  authed(async (userId, _req, res) => {
    res.json({ linked: !!(await getTelegramChatId(userId)) });
  }),
);

r.post(
  "/telegram/link-token",
  authed(async (userId, _req, res) => {
    if (!env.telegram.isAvailable) throw new HttpError(503, "Telegram is not configured");
    const token = await createLinkToken(userId);
    res.json({ deepLink: `https://t.me/${env.telegram.botUsername}?start=${token}` });
  }),
);

r.post(
  "/telegram/unlink",
  authed(async (userId, _req, res) => {
    await clearTelegramChatId(userId);
    res.json({ linked: false });
  }),
);

/** `/start <token>` — the one message that works before a link exists, since the token IS the proof
 * of identity (it was minted for a signed-in session and is single-use, see telegram.repo.ts). */
async function handleStart(chatId: string, token: string): Promise<void> {
  if (!token) {
    // A bare `/start` from an already-linked chat is a returning user, not a link attempt.
    const known = await getUserIdByChatId(chatId);
    await sendTelegramMessage(chatId, known ? HELP_TEXT : "Open the Account page in Zorya and tap “Link Telegram” to connect this chat.");
    return;
  }
  const linkedUserId = await resolveLinkToken(token);
  if (!linkedUserId) {
    await sendTelegramMessage(chatId, "This link has expired or was already used — generate a new one from the Account page.");
    return;
  }
  await setTelegramChatId(linkedUserId, chatId);
  await sendTelegramMessage(chatId, `✅ Your Zorya account is now linked.\n\n${HELP_TEXT}`);
}

/** An inline button tap on a notification we sent earlier. */
async function handleCallback(update: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const chatId = update.message?.chat?.id;
  const messageId = update.message?.message_id;
  // Answer FIRST, unconditionally: until Telegram gets this, the user's client shows a spinner on
  // the button, and every early return below would otherwise leave it spinning forever.
  if (update.id) await answerCallbackQuery(update.id);
  if (chatId == null || messageId == null) return;

  const userId = await getUserIdByChatId(String(chatId));
  if (!userId) return; // an unlinked chat — nothing to act on, and nothing to tell it

  const action = decodeCallback(update.data);
  if (!action) return; // a stale button from an older deploy, or a hand-crafted payload

  if (action.type === "dismiss") {
    await editTelegramMessage(String(chatId), messageId, "🙈 Dismissed.");
    return;
  }
  const result = await applyStatusChange(userId, action.vacancyId, action.status);
  // Rewrite the notification itself into its own receipt, and drop the keyboard with it — leaving
  // live buttons on a message whose action already happened invites a confusing second tap.
  await editTelegramMessage(String(chatId), messageId, result);
}

// Telegram calls this directly (registered once via server/scripts/set-telegram-webhook.mjs) —
// no session. If TELEGRAM_WEBHOOK_SECRET is set, every real call from Telegram carries it back as
// the X-Telegram-Bot-Api-Secret-Token header (Telegram's `secret_token` setWebhook param, Bot API
// 6.1+), checked below; a deployment that hasn't set one yet falls back to the URL alone being
// the only protection (same "optional, degrades gracefully" convention as the rest of this app's
// optional config), so upgrading to the secret is a config change, not a code change. This route
// still goes through the global apiLimiter (app.ts mounts it on all of "/api", no per-route
// skip), which bounds how many attempts a single IP can make in a window.
//
// Note what the secret does NOT do: it authenticates TELEGRAM, not the user. Which account an
// incoming message acts on comes exclusively from the chat id's row in `telegram_links` — see
// telegram.commands.ts's top comment.
r.post(
  "/telegram/webhook",
  asyncHandler(async (req, res) => {
    if (env.telegram.webhookSecret && req.header("X-Telegram-Bot-Api-Secret-Token") !== env.telegram.webhookSecret) {
      throw new HttpError(401, "Invalid webhook secret");
    }
    const update = req.body as TelegramUpdate;

    // Telegram requires a fast 200 regardless of what the update contained, or it retries the same
    // one repeatedly — and retries of a `/add` would create duplicate vacancies. So: answer first,
    // then do the work. Handlers below swallow their own errors for the same reason.
    res.status(200).json({ ok: true });

    try {
      if (update.callback_query) {
        await handleCallback(update.callback_query);
        return;
      }
      const chatId = update.message?.chat?.id;
      const text = update.message?.text?.trim() ?? "";
      if (chatId == null || !text) return;

      if (text.startsWith("/start")) {
        await handleStart(String(chatId), text.slice("/start".length).trim());
        return;
      }

      // Everything else needs an established link — this lookup is the authentication.
      const userId = await getUserIdByChatId(String(chatId));
      if (!userId) {
        await sendTelegramMessage(
          String(chatId),
          "This chat isn't linked to a Zorya account yet. Open the Account page and tap “Link Telegram”.",
        );
        return;
      }

      const reply = await handleCommand(userId, text);
      await sendTelegramMessage(String(chatId), reply.text, {
        ...(reply.vacancyId !== undefined ? { buttons: vacancyButtons(reply.vacancyId) } : {}),
      });

      // A freshly added vacancy gets its details filled in afterwards — seconds of fetching and
      // LLM work that must not sit between the user and the "added" confirmation above.
      if (reply.vacancyId !== undefined && reply.text.startsWith("✅")) {
        const summary = await enrichAddedVacancy(userId, reply.vacancyId);
        if (summary) await sendTelegramMessage(String(chatId), summary, { buttons: vacancyButtons(reply.vacancyId) });
      }
    } catch (err) {
      // The response already went out, so there's no status code left to set — but an unhandled
      // rejection here would otherwise reach index.ts's process-level handler and read like a crash.
      contextLogger().error({ err }, "Failed to process a Telegram update");
    }
  }),
);

export default r;
