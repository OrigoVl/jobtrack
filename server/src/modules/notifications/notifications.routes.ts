import express from "express";
import { authed } from "../../core/http.js";
import { OPT_OUTABLE_KINDS, sanitizeNotificationPrefs } from "../../shared/notifications.js";
import { isValidTimeZone } from "../../shared/time.js";
import { getNotificationSettings, setNotificationSettings } from "./notifications.repo.js";

const r = express.Router();

r.get(
  "/notifications/settings",
  authed(async (userId, _req, res) => {
    const settings = await getNotificationSettings(userId);
    // The kind list ships with the response rather than being hardcoded in the client: it's the
    // server that decides which kinds exist and which are opt-outable, and duplicating that list
    // in the UI would let the two drift silently.
    res.json({ ...settings, kinds: OPT_OUTABLE_KINDS });
  }),
);

r.put(
  "/notifications/settings",
  authed(async (userId, req, res) => {
    // sanitize, don't validate-and-reject: unknown keys are simply dropped (see
    // shared/notifications.ts), so an older client posting a kind this server no longer has is a
    // no-op rather than a 400 the user can't act on.
    const prefs = sanitizeNotificationPrefs(req.body?.prefs);
    const rawZone = typeof req.body?.timezone === "string" ? req.body.timezone : null;
    // A junk zone is dropped rather than rejected for the same reason, and because this value is
    // set by the browser automatically — the user never typed it and couldn't fix a rejection.
    const timezone = rawZone && isValidTimeZone(rawZone) ? rawZone : null;
    res.json(await setNotificationSettings(userId, { prefs, timezone }));
  }),
);

export default r;
