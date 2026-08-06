// Evidence, not effect: a referral row records "user B signed up via user A's link and, as of
// qualifiedAt, met the qualification bar" — it does NOT itself grant anything. The AI-quota
// bonus is a pure function of these rows (modules/billing/entitlements.ts adds
// countQualifiedReferrals(referrerUserId) * REFERRAL_BONUS_PER_REFERRAL, capped), so revoking a
// fraudulent referral (flipping status back to "revoked") self-corrects the referrer's bonus on
// their very next entitlements read — no compensating ledger entry needed anywhere else.
import { pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const referrals = pgTable(
  "referrals",
  {
    id: serial().primaryKey(),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Unique (see the index below): one referee can only ever be attributed to a single
    // referrer — the FIRST referral link they registered under wins (see
    // referrals.repo.ts#createReferral's ON CONFLICT DO NOTHING), not the last one they happen
    // to click.
    refereeUserId: text("referee_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "pending" | "qualified" | "revoked". Free text, same reasoning as subscriptions.plan — a
    // new state is a new string, not a schema change.
    status: text().notNull().default("pending"),
    // Best-effort abuse SIGNALS, not a block (see this file's top comment) — a /24-ish prefix and
    // the referee's email domain, both cheap to eyeball for "10 signups from the same network in
    // an hour" without storing a full IP (PII minimization) or blocking legitimate coworker
    // referrals that happen to share a domain.
    refereeIpPrefix: text("referee_ip_prefix"),
    refereeEmailDomain: text("referee_email_domain"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("referrals_referee_user_id_key").on(t.refereeUserId),
    index("referrals_referrer_user_id_idx").on(t.referrerUserId),
    index("referrals_status_idx").on(t.status),
  ],
);
