import express from "express";
import { HttpError, authed, asyncHandler } from "../../core/http.js";
import type { UserId } from "../../db/user-id.js";
import { getProfileFull } from "../cv/cv-profiles.repo.js";
import { getShareByProfile, getShareBySlug, generateShare, setShareEnabled } from "./cv-shares.repo.js";

const r = express.Router();

// Every route here is scoped to one CV profile (:id) — each profile has its own independent
// share link now, not one link per account.
async function requireOwnProfile(userId: UserId, id: number) {
  const profile = await getProfileFull(userId, id);
  if (!profile) throw new HttpError(404, "CV profile not found", null, "CV_PROFILE_NOT_FOUND");
  return profile;
}

// ---------- authed: manage a profile's own share link ----------
r.get(
  "/cv/profiles/:id/share",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    await requireOwnProfile(userId, id);
    res.json((await getShareByProfile(userId, id)) ?? null);
  }),
);
r.post(
  "/cv/profiles/:id/share",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    await requireOwnProfile(userId, id);
    res.json(await generateShare(userId, id));
  }),
);
r.put(
  "/cv/profiles/:id/share",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    await requireOwnProfile(userId, id);
    const existing = await getShareByProfile(userId, id);
    if (!existing) throw new HttpError(404, "No share link yet — generate one first", null, "CV_SHARE_NOT_GENERATED");
    const enabled = Boolean(req.body?.enabled);
    res.json(await setShareEnabled(userId, id, enabled));
  }),
);

// ---------- PUBLIC: no authed() — the slug itself is the only access control here.
// Deliberately returns ONLY the shape the public CV template needs (the CvDoc) — no email,
// no other profile field, nothing that would identify the account beyond what the user
// themselves already wrote into their own resume. ----------
r.get(
  "/cv/public/:slug",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || "");
    const share = await getShareBySlug(slug);
    if (!share || !share.enabled) throw new HttpError(404, "This CV link doesn't exist or has been disabled", null, "CV_SHARE_NOT_FOUND");
    const profile = await getProfileFull(share.userId, share.profileId);
    if (!profile) throw new HttpError(404, "This CV link doesn't exist or has been disabled", null, "CV_SHARE_NOT_FOUND");
    res.json({ doc: profile.doc });
  }),
);

export default r;
