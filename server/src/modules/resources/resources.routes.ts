import express from "express";
import { getDynamicResources, setFocusOverride } from "./resources.service.js";
import { getLocale } from "../../core/request-context.js";
import { authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";

const r = express.Router();

// Personalized against the caller's own profile skills + vacancy-derived demand (see
// resources.service.ts) — same static guide as before, but ranked/flagged per user, so this
// now needs a real session (the old anonymous, locale-only version didn't). getDynamicResources
// calls chatJson() (via getFocusNote/getPersonalizedActions) on a cache miss, same as every other
// LLM-backed route, so it needs aiLimiter too.
r.get(
  "/resources",
  aiLimiter,
  authed(async (userId, _req, res) => {
    const data = await getDynamicResources(userId, getLocale() === "uk");
    res.json(data);
  }),
);

// Sets (or, with a blank `text`, clears) the user's own focus note. No aiLimiter — this is the
// one path through the focus that never touches the LLM; that's the whole point of it.
r.put(
  "/resources/focus",
  authed(async (userId, req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const focus = await setFocusOverride(userId, text);
    res.json({ ok: true, focus, focusCustom: focus.length > 0 });
  }),
);

export default r;
