// Referral program: a referee signing up under a referrer's link (?ref=<referrer's userId> —
// there's no separate "referral code" concept, the userId itself IS the code, same
// hand-rolled-over-a-new-abstraction reasoning as the rest of this codebase's billing/auth) can
// eventually earn the referrer a capped AI-quota bonus. "Eventually": qualification requires the
// referee's email to be verified, a real action taken (not just a signup), and 72h to pass —
// each one closes off a cheap way to farm bonuses (fake emails, instant self-referrals, a bot
// that signs up and immediately churns).
import { contextLogger } from "../../core/logger.js";
import type { UserId } from "../../db/user-id.js";
import { notify } from "../../shared/notify.js";
import { countVacancies } from "../vacancies/vacancies.repo.js";
import {
  createReferral,
  countQualifiedReferrals,
  listPendingReferralsOlderThan,
  markReferralQualified,
  userExists,
} from "./referrals.repo.js";

export const REFERRAL_BONUS_PER_REFERRAL = 25;
export const REFERRAL_MAX_BONUS_REFERRALS = 5;
const QUALIFICATION_DELAY_MS = 72 * 60 * 60 * 1000;

/** Pure — the 72h delay itself is enforced by the repo query's cutoff (listPendingReferralsOlderThan),
 * not here, so this only ever has to reason about the other two conditions. */
export function isEligibleForQualification(refereeEmailVerified: boolean, hasActivity: boolean): boolean {
  return refereeEmailVerified && hasActivity;
}

/** The AI-quota bonus itself — a pure function of how many of THIS referrer's referrals are
 * currently "qualified" (entitlements.ts adds this to the Free plan's monthly call ceiling).
 * Capped: past REFERRAL_MAX_BONUS_REFERRALS, chasing more referrals stops paying off, which is
 * what makes the cap a real anti-fraud measure rather than just a marketing number. */
export async function getReferralBonusCalls(referrerUserId: UserId): Promise<number> {
  const qualified = await countQualifiedReferrals(referrerUserId);
  return Math.min(qualified, REFERRAL_MAX_BONUS_REFERRALS) * REFERRAL_BONUS_PER_REFERRAL;
}

// Exported for direct unit testing (see referrals.service.test.ts) — both are pure string
// munging with no DB involvement, no reason to only exercise them indirectly through claimReferral().
export function ipPrefix(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = /^(\d+\.\d+\.\d+)\.\d+$/.exec(ip);
  if (v4) return `${v4[1]}.0/24`;
  // IPv6 (or anything else with colons) — first 3 hextets only, never the full address: enough
  // to spot "same network" without storing something that identifies a specific device.
  const hextets = ip.split(":");
  return hextets.length >= 3 ? `${hextets.slice(0, 3).join(":")}::/48` : null;
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

/** Called once, right after a NEW user's first authenticated request (see referrals.routes.ts) —
 * idempotent both ways: a bogus/unknown code, a self-referral attempt, and a referee who already
 * has a referral row (from this same code or a different one) all just return false, never throw.
 * Creates a "pending" row only — qualifyPendingReferrals() below is what ever grants the bonus. */
export async function claimReferral(code: string, refereeUserId: UserId, signals: { ip: string | null; email: string }): Promise<boolean> {
  const referrerUserId = code as UserId;
  if (!code || referrerUserId === refereeUserId) return false;
  if (!(await userExists(referrerUserId))) return false;
  return createReferral(referrerUserId, refereeUserId, {
    refereeIpPrefix: ipPrefix(signals.ip),
    refereeEmailDomain: emailDomain(signals.email),
  });
}

/** Run from digest.scheduler.ts's existing 12h tick (see that file's own comment on why this
 * doesn't get a third setInterval) — sweeps every "pending" referral old enough to possibly
 * qualify and promotes the ones that actually meet the bar. One user's malformed data must never
 * stop the rest of the sweep, same fail-isolation shape as runDigestOnce()'s own per-user loop. */
export async function qualifyPendingReferrals(nowMs: number = Date.now()): Promise<number> {
  const cutoff = new Date(nowMs - QUALIFICATION_DELAY_MS);
  const candidates = await listPendingReferralsOlderThan(cutoff);
  let qualifiedCount = 0;
  for (const c of candidates) {
    try {
      const hasActivity = (await countVacancies(c.refereeUserId)) > 0;
      if (isEligibleForQualification(c.refereeEmailVerified, hasActivity)) {
        await markReferralQualified(c.id, nowMs);
        qualifiedCount++;
        // The referrer's quota just went up and nothing else would ever tell them so — the bonus is
        // granted by a background sweep, not by anything they did. Keyed on the referral id so a
        // re-run of the sweep can't congratulate them twice for the same person, and deliberately
        // says nothing identifying about the referee.
        await notify(c.referrerUserId, {
          kind: "referral",
          text: `🎁 One of your referrals just qualified — +${REFERRAL_BONUS_PER_REFERRAL} AI calls a month, up to ${REFERRAL_MAX_BONUS_REFERRALS} referrals.`,
          dedupeKey: `referral:${c.id}`,
        });
      }
    } catch (err) {
      contextLogger().error({ err, referralId: c.id }, "Failed to evaluate one pending referral");
    }
  }
  return qualifiedCount;
}
