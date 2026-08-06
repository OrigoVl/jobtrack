// Subscription/billing state. Nothing here is read on every request except getEntitlements()'s
// single PK lookup (server/src/modules/billing/entitlements.ts) — everything else about a
// subscription (card, invoices, cancel/resume) lives in Stripe and is reached via the Billing
// Portal, not mirrored here. See server/src/modules/billing/ for how these are written/read.
import { pgTable, integer, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

const userIdCol = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// One row per user — the user's current plan/billing state, following digest_preferences'
// precedent (app.ts): userId IS the primary key (one row per user is the table's only real
// identity), real columns rather than a jsonb blob because `plan`/`status` are read on the hot
// AI-call path and must be WHERE-able for admin aggregates. A MISSING ROW means Free/never-
// subscribed — nothing backfills a row for existing users, and entitlementsFor() treats a null
// row the same as one with plan:"free".
export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: userIdCol().primaryKey(),
    // "free" | "pro" | "team". Free text, not a pg enum — same reasoning as llmUsage.feature: a
    // new tier is a new value here with zero schema change. Derived server-side from
    // stripePriceId (modules/billing/plans.ts#planForPriceId), never from Stripe's mutable
    // subscription nickname.
    plan: text().notNull().default("free"),
    // Stripe's subscription.status verbatim ("active"|"trialing"|"past_due"|"canceled"|
    // "unpaid"|"incomplete"|"incomplete_expired"|"paused"), plus our own "inactive" for "never
    // subscribed". Stored raw so a status Stripe adds later doesn't silently coerce into
    // something wrong — entitlementsFor() decides what each one grants.
    status: text().notNull().default("inactive"),
    // Nullable: a user who never opened checkout has none of these. Unique because they're the
    // webhook's lookup keys (see billing.repo.ts#getSubscriptionByStripeCustomerId).
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    // Which Stripe Price is active — the source of truth `plan` above is derived from, and what
    // makes a future annual/Team price a config change rather than a migration.
    stripePriceId: text("stripe_price_id"),
    // Belt-and-braces for a webhook that never arrived: entitlementsFor() denies access once this
    // is in the past even if `status` still says "active". Also what the Account page shows as
    // "renews on"/"access until".
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "string" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    // ---- Team-tier forward compatibility. NOT read or written by any code path today.
    // How many seats this subscription pays for. 1 for Free/Pro.
    seats: integer().notNull().default(1),
    // NULL today, always. When a Team tier ships, a seat member's row carries plan:"team" +
    // grantedByUserId:<owner's id> — getEntitlements() needs no change, since it already reads
    // THIS user's own row, which already says plan:"team". Seat revocation rewrites member rows;
    // that's a write-path concern only, not a read-path one.
    grantedByUserId: text("granted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    // Last Stripe event actually applied to this row — lets an admin tell "webhooks stopped
    // arriving" apart from "this user simply never subscribed".
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_stripe_customer_id_key").on(t.stripeCustomerId),
    uniqueIndex("subscriptions_stripe_subscription_id_key").on(t.stripeSubscriptionId),
  ],
);

// Webhook idempotency ledger. Stripe delivers at-least-once and retries on any non-2xx, so the
// same event id can arrive more than once. Deliberately NOT userId-scoped — this isn't tenant
// data, it's a dedupe ledger, the same justification db/llm-cache.ts gives for being global.
export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: text().primaryKey(), // Stripe's own "evt_..." id IS the idempotency key
    type: text().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stripe_events_type_idx").on(t.type)],
);
