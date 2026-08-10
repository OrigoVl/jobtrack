// The closed set of things this app will ever push at a user, plus the per-kind opt-out defaults.
// Pure and DB-free on purpose: the wire values are persisted (digest_preferences.notification_prefs
// keys) and read by the client's preferences UI, so they need a single definition both the
// scheduler and the routes can import without dragging in a Postgres connection.
//
// These are WIRE values — never translate them (CLAUDE.md's "never translate a persisted wire
// value"); the client maps each to a display label in its own i18n namespace.

export const NOTIFICATION_KINDS = [
  /** An interview on the calendar is coming up (24h and 1h before). */
  "interview",
  /** A vacancy's own `next` date has arrived. */
  "nextStep",
  /** An application has gone quiet past the staleness threshold. */
  "stale",
  /** The study streak is alive but today has no activity yet. */
  "streak",
  /** A saved search turned up new postings. */
  "jobAlert",
  /** The weekly digest, as a Telegram copy of the email. */
  "digest",
  /** Somebody opened a public CV share link. */
  "cvView",
  /** A referral crossed the qualification bar. */
  "referral",
  /** Payment failed, or a subscription is about to lapse. */
  "billing",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

// Every kind ships ON. A user who linked a chat asked to hear from the bot, and a notification
// nobody opted into is exactly the thing the per-kind toggles exist to switch off — defaulting to
// off instead would mean the feature does nothing until it's discovered in settings.
//
// `billing` is the one kind deliberately NOT listed as opt-outable in the UI (see
// notifications.routes.ts): a failed payment is transactional, not promotional.
export const DEFAULT_NOTIFICATION_ENABLED = true;

/** The kinds a user is allowed to switch off. `billing` is excluded on purpose — see above. */
export const OPT_OUTABLE_KINDS: readonly NotificationKind[] = NOTIFICATION_KINDS.filter((k) => k !== "billing");

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/**
 * Whether a given kind is on for a user, against their SPARSE stored preferences (a missing key
 * means "never touched, use the default" — see the column comment in db/schema/app.ts). Pure, so
 * the defaulting rule is unit-testable without a DB.
 */
export function isNotificationEnabled(prefs: Record<string, boolean> | null | undefined, kind: NotificationKind): boolean {
  if (kind === "billing") return true; // not opt-outable; ignore a stale/hand-written stored value
  return prefs?.[kind] ?? DEFAULT_NOTIFICATION_ENABLED;
}

/**
 * Narrows arbitrary JSON (a request body, a jsonb column read back) to storable preferences:
 * unknown keys and non-boolean values are dropped, and so is any key that isn't opt-outable, so a
 * crafted request can't switch off a transactional notification or bloat the blob.
 * Only explicit `false` is kept — an explicit `true` equals the default, and storing it would grow
 * the blob for no behavioral difference (and would freeze the value if the default ever changes).
 */
export function sanitizeNotificationPrefs(input: unknown): Record<string, boolean> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, boolean> = {};
  for (const kind of OPT_OUTABLE_KINDS) {
    if ((input as Record<string, unknown>)[kind] === false) out[kind] = false;
  }
  return out;
}
