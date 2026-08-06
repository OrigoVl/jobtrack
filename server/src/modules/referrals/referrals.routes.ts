import express from "express";
import { authed } from "../../core/http.js";
import { getUserEmail } from "../billing/billing.repo.js";
import { getReferralForReferee, countPendingReferrals, countQualifiedReferrals } from "./referrals.repo.js";
import { claimReferral, getReferralBonusCalls } from "./referrals.service.js";

const r = express.Router();

// The referral "code" IS the referrer's own userId — no separate code table, no vanity slugs
// (see referrals.service.ts's top comment). The client builds the shareable link itself
// (`${origin}/register?ref=${code}`) from this value.
r.get(
  "/referrals/me",
  authed(async (userId, _req, res) => {
    const [pending, qualified, bonusCallsPerMonth] = await Promise.all([
      countPendingReferrals(userId),
      countQualifiedReferrals(userId),
      getReferralBonusCalls(userId),
    ]);
    res.json({ code: userId, pending, qualified, bonusCallsPerMonth });
  }),
);

// Fired once by the client on a new user's first authenticated page load, if a `?ref=` code was
// captured at registration time (see client's ReferralClaimer / register.tsx). Idempotent: a
// user who already has a referral row (from this call or a previous attempt), an unknown code,
// or a self-referral attempt all just come back `claimed: false` — never an error, since none of
// those are actually exceptional from the caller's point of view.
r.post(
  "/referrals/claim",
  authed(async (userId, req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.trim().slice(0, 200) : "";
    const existing = await getReferralForReferee(userId);
    if (existing || !code) {
      res.json({ claimed: false });
      return;
    }
    const email = await getUserEmail(userId);
    const claimed = await claimReferral(code, userId, { ip: req.ip ?? null, email: email ?? "" });
    res.json({ claimed });
  }),
);

export default r;
