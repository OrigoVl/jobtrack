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
// no session, protected only by the URL itself (Telegram's webhook mechanism doesn't support an
// arbitrary custom header for a shared secret without extra per-request setup). Low blast
// radius: the only thing a forged POST here can do is attempt resolveLinkToken() with a guessed
// token, which requires having observed (or brute-forced, from a 15-minute-lived, 128-bit random
// space) an unexpired token belonging to someone else's link attempt.
r.post(
  "/telegram/webhook",
  asyncHandler(async (req, res) => {
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
