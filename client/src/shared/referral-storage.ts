// A referral code (see server/src/modules/referrals/referrals.service.ts's top comment — it's
// just the referrer's own userId, no separate code concept) has to survive from the moment a
// visitor lands on /register?ref=<code> to the moment they have a real session: email+password
// signup requires email verification first (no session yet), and Google OAuth redirects away
// and back. localStorage is the one thing that survives both of those without a server round
// trip — see register.tsx (writer) and app/App.tsx's ReferralClaimer (reader/consumer).
const KEY = "zorya:referralCode";

export function storeReferralCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Storage can be unavailable (private browsing, quota) — a referral bonus is a nice-to-have,
    // never worth throwing over.
  }
}

export function takeStoredReferralCode(): string | null {
  try {
    const code = localStorage.getItem(KEY);
    if (code) localStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
