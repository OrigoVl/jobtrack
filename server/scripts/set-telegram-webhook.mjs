// Registers this deployment's /api/telegram/webhook URL with Telegram (a one-time, out-of-band
// action — Telegram calls setWebhook once per bot, not something the running server does on its
// own boot, since that would re-register on every restart for no reason). Requires
// TELEGRAM_BOT_TOKEN in the environment; BETTER_AUTH_URL (the app's own public origin) as the
// base for the webhook path, same value auth/auth.ts already uses for callback URLs. If
// TELEGRAM_WEBHOOK_SECRET is set, it's passed as Telegram's `secret_token` param, so the running
// server's own check (telegram.routes.ts) has something real to verify against.
//
// Usage: node server/scripts/set-telegram-webhook.mjs
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set — configure it in server/.env first.");
  process.exit(1);
}

const baseUrl = process.env.BETTER_AUTH_URL;
if (!baseUrl) {
  console.error("BETTER_AUTH_URL is not set — it must be this deployment's public https origin.");
  process.exit(1);
}

const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!secret) {
  console.warn("TELEGRAM_WEBHOOK_SECRET is not set — registering without a shared secret. Anyone who");
  console.warn("learns this URL can call it unauthenticated. Set TELEGRAM_WEBHOOK_SECRET and rerun this");
  console.warn("script to close that gap.");
}

const webhookUrl = `${baseUrl}/api/telegram/webhook`;
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(secret ? { url: webhookUrl, secret_token: secret } : { url: webhookUrl }),
});
const body = await res.json();
if (!res.ok || !body.ok) {
  console.error("Failed to set Telegram webhook:", body);
  process.exit(1);
}
console.log(`Telegram webhook registered: ${webhookUrl}`);
