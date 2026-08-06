// A single per-user flag — "has this account seen the post-registration /welcome flow" — stored
// in the generic user_kv table (db/kv.ts#getKvJson/setKvJson), not a dedicated table: unlike
// digest_preferences (which needs a real column for a scheduler's WHERE-scan across every user),
// nothing ever queries this across users, so the generic KV store is the right fit here, not
// overkill for it.
import express from "express";
import { authed } from "../../core/http.js";
import { getKvJson, setKvJson } from "../../db/kv.js";

const r = express.Router();
const WELCOME_SEEN_KEY = "onboarding.welcomeSeen";

r.get(
  "/onboarding/state",
  authed(async (userId, _req, res) => {
    res.json({ welcomeSeen: (await getKvJson<boolean>(userId, WELCOME_SEEN_KEY)) ?? false });
  }),
);

r.post(
  "/onboarding/welcome-seen",
  authed(async (userId, _req, res) => {
    await setKvJson(userId, WELCOME_SEEN_KEY, true);
    res.json({ welcomeSeen: true });
  }),
);

export default r;
