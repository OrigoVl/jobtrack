import express from "express";
import { HttpError, authed, asyncHandler } from "../../core/http.js";
import { getKvJson } from "../../db/index.js";
import { CvDocSchema } from "../cv/cv.schemas.js";
import { getShareByUserId, getShareBySlug, generateShare, setShareEnabled } from "./cv-shares.repo.js";

const r = express.Router();

// ---------- authed: manage my own share link ----------
r.get(
  "/cv/share",
  authed(async (userId, _req, res) => {
    res.json((await getShareByUserId(userId)) ?? null);
  }),
);
r.post(
  "/cv/share",
  authed(async (userId, _req, res) => {
    res.json(await generateShare(userId));
  }),
);
r.put(
  "/cv/share",
  authed(async (userId, req, res) => {
    const existing = await getShareByUserId(userId);
    if (!existing) throw new HttpError(404, "No share link yet — generate one first", null, "CV_SHARE_NOT_GENERATED");
    const enabled = Boolean(req.body?.enabled);
    res.json(await setShareEnabled(userId, enabled));
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
    const stored = await getKvJson(share.userId, "cvDoc");
    if (!stored) throw new HttpError(404, "This CV link doesn't exist or has been disabled", null, "CV_SHARE_NOT_FOUND");
    res.json({ doc: CvDocSchema.parse(stored) });
  }),
);

export default r;
