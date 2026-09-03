// A per-user, admin-controlled top-up on the Free plan's monthly AI-call quota (the "grant bonus
// AI calls" rescue hatch — modules/admin/admin.service.ts#grantBonusAiCalls). Stored as a single
// `user_kv` row rather than a dedicated table: it's one bare integer, nothing else joins to it by
// id, and nothing needs a `WHERE` scan across every user's row (see CLAUDE.md's "dedicated table
// vs. user_kv" guidance) — the same shape as db/kv.ts's studyStreak/applyGoalWeekly.
//
// Deliberately NOT reusing referrals.service.ts's getReferralBonusCalls: that number is *computed*
// (qualified-referral rows, capped at REFERRAL_MAX_BONUS_REFERRALS) and driven entirely by the
// referral anti-fraud rules — bending it to also carry an admin's arbitrary grant would either
// blow past that cap for the wrong reason or require faking referral rows, neither of which is
// "give this user N bonus calls" in any honest sense. Composed additively with the referral bonus
// in entitlements.ts#getEntitlements, same as that bonus itself.
import { getKvJson, setKvJson } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";

const KEY = "adminBonusAiCalls";

interface AdminBonusAiCallsValue {
  count: number;
}

export async function getAdminBonusAiCalls(userId: UserId): Promise<number> {
  const v = await getKvJson<AdminBonusAiCallsValue>(userId, KEY);
  return v?.count ?? 0;
}

/** Adds `delta` (may be negative, e.g. correcting a mistaken grant) to this user's standing
 * bonus, floored at 0 so a correction can never push a user into a negative quota bump. Returns
 * the resulting total. */
export async function addAdminBonusAiCalls(userId: UserId, delta: number): Promise<number> {
  const next = Math.max(0, (await getAdminBonusAiCalls(userId)) + delta);
  await setKvJson(userId, KEY, { count: next });
  return next;
}
