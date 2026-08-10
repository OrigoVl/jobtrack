// Encoding for inline-button `callback_data`. Pure string munging, no DB — so the format is
// unit-testable on its own, and so the webhook can reject a malformed payload before it ever
// touches a repository.
//
// The Bot API caps callback_data at 64 BYTES, which is the whole reason this is a compact code
// scheme rather than JSON: `{"action":"status","vacancyId":1234,"status":"Take-home task"}` is
// already over budget before the status even gets long. Hence "v:1234:t" — a one-letter status
// code, not the wire status itself.
//
// The codes are an INTERNAL transport detail, not a persisted value: nothing stores them, and
// they're decoded back to a real VacancyStatus (shared/validation.ts's STATUSES) before anything
// is written. That's what keeps this from being a second, competing spelling of the status enum.
import type { VacancyStatus } from "../../shared/validation.js";

/** The subset of statuses worth a one-tap button — the transitions a notification actually
 * prompts. Deliberately not all nine: a keyboard with nine buttons is unusable on a phone, and the
 * rest are rare enough to be worth opening the app for. */
const STATUS_CODES: Record<string, VacancyStatus> = {
  a: "Applied",
  r: "Rejected",
  o: "Offer",
  p: "Paused",
};

export type CallbackAction = { type: "status"; vacancyId: number; status: VacancyStatus } | { type: "dismiss" };

export function encodeStatusCallback(vacancyId: number, status: VacancyStatus): string {
  const code = Object.keys(STATUS_CODES).find((c) => STATUS_CODES[c] === status);
  if (!code) throw new Error(`No callback code for status "${status}"`);
  return `v:${vacancyId}:${code}`;
}

export const DISMISS_CALLBACK = "x";

/** Returns null for anything that doesn't parse — a stale button from an older deploy, or a
 * hand-crafted payload. The webhook treats null as "ignore, but still answer the query" so the
 * user's client doesn't sit on a spinner. */
export function decodeCallback(data: string | undefined): CallbackAction | null {
  if (!data) return null;
  if (data === DISMISS_CALLBACK) return { type: "dismiss" };
  const match = /^v:(\d+):([a-z])$/.exec(data);
  if (!match) return null;
  const status = STATUS_CODES[match[2]!];
  if (!status) return null;
  return { type: "status", vacancyId: Number(match[1]), status };
}

/** The standard keyboard hung under any vacancy-related notification. Two rows so the labels stay
 * readable on a narrow phone screen. */
export function vacancyButtons(vacancyId: number): { text: string; callbackData: string }[][] {
  return [
    [
      { text: "✅ Applied", callbackData: encodeStatusCallback(vacancyId, "Applied") },
      { text: "❌ Rejected", callbackData: encodeStatusCallback(vacancyId, "Rejected") },
    ],
    [
      { text: "⏸ Paused", callbackData: encodeStatusCallback(vacancyId, "Paused") },
      { text: "🙈 Dismiss", callbackData: DISMISS_CALLBACK },
    ],
  ];
}
