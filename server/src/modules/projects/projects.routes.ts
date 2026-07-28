import express from "express";
import { getChecklistProgress, toggleChecklistItem } from "../../db/index.js";
import { PROJECTS } from "./projects.data.js";
import { HttpError, authed } from "../../core/http.js";

const r = express.Router();

// ---------- pet projects ----------
r.get(
  "/projects",
  authed(async (userId, _req, res) => {
    res.json({ projects: PROJECTS, progress: await getChecklistProgress(userId, "projectProgress") });
  }),
);
r.put(
  "/projects/progress",
  authed(async (userId, req, res) => {
    const itemId = String(req.body?.itemId || "");
    const done = Boolean(req.body?.done);
    const valid = PROJECTS.some((p) => p.dod.some((d) => d.id === itemId));
    if (!valid) throw new HttpError(400, `Unknown item: "${itemId}"`);
    res.json({ ok: true, progress: await toggleChecklistItem(userId, "projectProgress", itemId, done) });
  }),
);

export default r;
