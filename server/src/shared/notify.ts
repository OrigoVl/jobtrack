// The single seam between "something happened" and "the user hears about it".
//
// Before this existed, each sender hand-rolled the same four steps — look up the chat id, check
// it's non-null, render text, call the Bot API — which was fine for two senders and stops being
// fine at nine. Worse, none of them could honor a per-kind opt-out or notice that a user had
// blocked the bot, because that logic had nowhere to live. It lives here.
//
// Deliberately NOT a generic pub/sub or a queue: this app's schedulers are plain setInterval for
// the reasons their own top comments give, and a notification bus would be the same
// over-engineering one layer up. This is one function that fans out to at most two channels.
import { contextLogger } from "../core/logger.js";
import type { UserId } from "../db/user-id.js";
import { sendEmail } from "./email.js";
import { sendTelegramMessage, type TelegramButton } from "./telegram.js";
import { isNotificationEnabled, type NotificationKind } from "./notifications.js";

// The two repositories this needs are imported LAZILY (dynamic import inside the function, not a
// static top-level one) for exactly the reason core/http.ts does the same with auth/auth.js: they
// pull in db/client.ts, which opens a real Postgres connection pool as a side effect of being
// imported. notify() is called from services that are otherwise DB-free at import time and are
// unit-tested with a mocked env — billing.service.ts most notably — and a static import here would
// force every one of those test files to either stand up a database or mock this module, for a
// dependency they never exercise. Node caches the dynamic import after the first call.
async function repos() {
  const [telegram, notifications] = await Promise.all([
    import("../modules/telegram/telegram.repo.js"),
    import("../modules/notifications/notifications.repo.js"),
  ]);
  return { ...telegram, ...notifications };
}

export interface NotifyInput {
  kind: NotificationKind;
  /** Plain text for Telegram — see sendTelegramMessage's own note on why never HTML. */
  text: string;
  /** Optional inline buttons rendered under the Telegram message. */
  buttons?: TelegramButton[][];
  /**
   * Adding this ALSO sends an email. Omit it for Telegram-only pings — most notifications here are
   * deliberately Telegram-only, because the whole point of the channel is to take the
   * time-sensitive traffic that email is bad at rather than to double every message.
   */
  email?: { subject: string; html: string };
  /**
   * When set, the notification is sent at most once per (user, key) — see
   * notifications.repo.ts#claimNotification. Omit for something that genuinely should fire every
   * time it happens.
   */
  dedupeKey?: string;
  /** TTL for `dedupeKey`; omitted means once, ever. */
  dedupeTtlMs?: number;
}

/**
 * Prefetched context for callers that already have it — the schedulers iterate a batch and would
 * otherwise re-query the same chat id and preferences per user, per notification kind, per tick.
 * Event-triggered callers (an HTTP handler reacting to one thing) just omit it and let notify()
 * look it up.
 */
export interface NotifyContext {
  chatId?: string | null;
  prefs?: Record<string, boolean>;
}

export type NotifyResult = "sent" | "suppressed" | "no-channel" | "duplicate";

/**
 * Returns WHY nothing was sent rather than a bare boolean — the schedulers log it, and "the user
 * opted out" vs "we already sent this" vs "no chat linked" are three very different things when
 * someone reports not receiving a notification.
 *
 * Never throws. Every caller is either a background tick (where one user's failure must not stop
 * the batch) or a side effect hanging off an unrelated HTTP request (where it must not turn a
 * successful action into a 500) — so a failure here is logged and swallowed, the same call this
 * codebase already makes in sendEmail/sendTelegramMessage.
 */
export async function notify(userId: UserId, input: NotifyInput, ctx: NotifyContext = {}): Promise<NotifyResult> {
  try {
    const { claimNotification, clearTelegramChat, getPrefsForUser, getTelegramChatId, getUserEmail } = await repos();
    const prefs = ctx.prefs ?? (await getPrefsForUser(userId));
    if (!isNotificationEnabled(prefs, input.kind)) return "suppressed";

    const chatId = ctx.chatId !== undefined ? ctx.chatId : await getTelegramChatId(userId);
    if (!chatId && !input.email) return "no-channel";

    // Claimed BEFORE sending, not after: a crash between send and mark would otherwise re-send on
    // the next tick, and for these notifications a duplicate is worse than a miss (the whole point
    // of the ledger). The claim also covers the email leg, so the two channels can't diverge.
    if (input.dedupeKey && !(await claimNotification(userId, input.dedupeKey, input.dedupeTtlMs))) {
      return "duplicate";
    }

    if (chatId) {
      const result = await sendTelegramMessage(chatId, input.text, { buttons: input.buttons });
      // The user blocked the bot or deleted the chat. Retrying can never succeed, so drop the link
      // instead of pushing at a dead chat on every tick from now on. They can re-link from
      // /account whenever they want; nothing else about their account is touched.
      if (result === "blocked") {
        await clearTelegramChat(chatId);
        contextLogger().info({ userId, kind: input.kind }, "Telegram chat is gone — link removed");
      }
    }

    if (input.email) {
      const address = await getUserEmail(userId);
      if (address) await sendEmail({ to: address, subject: input.email.subject, html: input.email.html });
    }
    return "sent";
  } catch (err) {
    contextLogger().error({ err, userId, kind: input.kind }, "Failed to deliver a notification");
    return "no-channel";
  }
}
