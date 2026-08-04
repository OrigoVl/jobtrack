import express from "express";
import { authed } from "../../core/http.js";
import { parseDigestPreferencesInput } from "../../shared/validation.js";
import { getDigestPreferences, setDigestEnabled } from "./digest.repo.js";

const r = express.Router();

// ---------- email digest preferences ----------
r.get(
  "/digest/preferences",
  authed(async (userId, _req, res) => {
    res.json(await getDigestPreferences(userId));
  }),
);

r.put(
  "/digest/preferences",
  authed(async (userId, req, res) => {
    const { enabled } = parseDigestPreferencesInput(req.body);
    res.json(await setDigestEnabled(userId, enabled));
  }),
);

export default r;
