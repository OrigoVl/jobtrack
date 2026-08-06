import express from "express";
import { authed, asyncHandler, HttpError } from "../../core/http.js";
import { env } from "../../config/env.js";
import { sendTelegramMessage, type TelegramUpdate } from "../../shared/telegram.js";
import { clearTelegramChatId, createLinkToken, getTelegramChatId, resolveLinkToken, setTelegramChatId } from "./telegram.repo.js";

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

// Telegram calls this directly (registered once via server/scripts/set-telegram-webhook.mjs) —
// no session. If TELEGRAM_WEBHOOK_SECRET is set, every real call from Telegram carries it back as
// the X-Telegram-Bot-Api-Secret-Token header (Telegram's `secret_token` setWebhook param, Bot API
// 6.1+), checked below; a deployment that hasn't set one yet falls back to the URL alone being
// the only protection (same "optional, degrades gracefully" convention as the rest of this app's
// optional config), so upgrading to the secret is a config change, not a code change. This route
// still goes through the global apiLimiter (app.ts mounts it on all of "/api", no per-route
// skip), which bounds how many attempts a single IP can make in a window.
r.post(
  "/telegram/webhook",
  asyncHandler(async (req, res) => {
    if (env.telegram.webhookSecret && req.header("X-Telegram-Bot-Api-Secret-Token") !== env.telegram.webhookSecret) {
      throw new HttpError(401, "Invalid webhook secret");
    }
    const update = req.body as TelegramUpdate;
    const text = update.message?.text?.trim() ?? "";
    const chatId = update.message?.chat?.id;
    if (chatId != null && text.startsWith("/start")) {
      const token = text.slice("/start".length).trim();
      if (token) {
        const linkedUserId = await resolveLinkToken(token);
        if (linkedUserId) {
          await setTelegramChatId(linkedUserId, String(chatId));
          await sendTelegramMessage(
            String(chatId),
            "✅ Your Zorya account is now linked. You'll get job-alert and weekly-digest notifications here.",
          );
        } else {
          await sendTelegramMessage(
            String(chatId),
            "This link has expired or was already used — generate a new one from the Account page.",
          );
        }
      }
    }
    // Telegram requires a fast 200 regardless of what the message contained, or it retries the
    // same update repeatedly.
    res.status(200).json({ ok: true });
  }),
);

export default r;
