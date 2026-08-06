// Repository wrapping the `referrals` table (db/schema/referrals.ts — see that file's top
// comment for the "evidence, not effect" design). Static `db` import, same reasoning as
// billing.repo.ts: nothing here is on a path any test needs to run without a real DB.
import { and, eq, lt } from "drizzle-orm";
import db from "../../db/client.js";
import { referrals, user } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

export interface ReferralRow {
  id: number;
  referrerUserId: UserId;
  refereeUserId: UserId;
  status: string;
  createdAt: Date;
}

/** True the FIRST time this referee is attributed to ANY referrer — same "atomic
 * insert-with-conflict-check, not read-then-write" shape as billing.repo.ts#recordStripeEventOnce,
 * here guarding against a referee claiming two different referral links (the unique index on
 * refereeUserId is the actual guarantee; this is just how the caller learns whether it won). */
export async function createReferral(
  referrerUserId: UserId,
  refereeUserId: UserId,
  signals: { refereeIpPrefix: string | null; refereeEmailDomain: string | null },
): Promise<boolean> {
  const inserted = await db
    .insert(referrals)
    .values({ referrerUserId, refereeUserId, ...signals })
    .onConflictDoNothing()
    .returning({ id: referrals.id });
  return inserted.length > 0;
}

export async function getReferralForReferee(refereeUserId: UserId): Promise<ReferralRow | null> {
  const [row] = await db
    .select({
      id: referrals.id,
      referrerUserId: referrals.referrerUserId,
      refereeUserId: referrals.refereeUserId,
      status: referrals.status,
      createdAt: referrals.createdAt,
    })
    .from(referrals)
    .where(eq(referrals.refereeUserId, refereeUserId));
  return row ? { ...row, referrerUserId: row.referrerUserId as UserId, refereeUserId: row.refereeUserId as UserId } : null;
}

/** Drives the AI-quota bonus (entitlements.ts) — a pure count of this referrer's "qualified"
 * rows, so revoking one (status -> "revoked") shrinks the bonus on the referrer's very next read
 * with zero extra bookkeeping. */
export async function countQualifiedReferrals(referrerUserId: UserId): Promise<number> {
  const rows = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.referrerUserId, referrerUserId), eq(referrals.status, "qualified")));
  return rows.length;
}

export async function countPendingReferrals(referrerUserId: UserId): Promise<number> {
  const rows = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.referrerUserId, referrerUserId), eq(referrals.status, "pending")));
  return rows.length;
}

export interface PendingReferralForSweep {
  id: number;
  refereeUserId: UserId;
  refereeEmailVerified: boolean;
}

/** Candidates for the qualification sweep (referrals.service.ts#qualifyPendingReferrals) — only
 * rows old enough to have possibly cleared the 72h delay; the sweep itself still re-checks
 * emailVerified + real activity, this just keeps the scan from re-reading rows that are
 * mathematically too young every single tick. */
export async function listPendingReferralsOlderThan(cutoff: Date): Promise<PendingReferralForSweep[]> {
  const rows = await db
    .select({ id: referrals.id, refereeUserId: referrals.refereeUserId, refereeEmailVerified: user.emailVerified })
    .from(referrals)
    .innerJoin(user, eq(user.id, referrals.refereeUserId))
    .where(and(eq(referrals.status, "pending"), lt(referrals.createdAt, cutoff)));
  return rows.map((r) => ({ ...r, refereeUserId: r.refereeUserId as UserId }));
}

export async function markReferralQualified(id: number, nowMs: number): Promise<void> {
  await db
    .update(referrals)
    .set({ status: "qualified", qualifiedAt: new Date(nowMs) })
    .where(eq(referrals.id, id));
}

/** Checked before createReferral() so a garbage/typo'd `?ref=` code fails as a normal "not
 * claimed" result instead of a raw FK-violation throw from the insert. */
export async function userExists(id: UserId): Promise<boolean> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, id));
  return row !== undefined;
}
