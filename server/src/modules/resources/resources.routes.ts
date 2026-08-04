import express from "express";
import { getDynamicResources } from "./resources.service.js";
import { getLocale } from "../../core/request-context.js";
import { authed } from "../../core/http.js";

const r = express.Router();

// Personalized against the caller's own profile skills + vacancy-derived demand (see
// resources.service.ts) — same static guide as before, but ranked/flagged per user, so this
// now needs a real session (the old anonymous, locale-only version didn't).
r.get(
  "/resources",
  authed(async (userId, _req, res) => {
    const data = await getDynamicResources(userId, getLocale() === "uk");
    res.json(data);
  }),
);

export default r;
