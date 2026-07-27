import express from "express";
import { getChecklistProgress, toggleChecklistItem } from "../../db/index.js";
import { PROJECTS } from "./projects.data.js";
import { HttpError } from "../../core/http.js";

const r = express.Router();

// ---------- pet-проєкти ----------
r.get("/projects", (_q, res) => res.json({ projects: PROJECTS, progress: getChecklistProgress("projectProgress") }));
r.put("/projects/progress", (req, res) => {
  const itemId = String(req.body?.itemId || "");
  const done = Boolean(req.body?.done);
  const valid = PROJECTS.some((p) => p.dod.some((d) => d.id === itemId));
  if (!valid) throw new HttpError(400, `Невідомий пункт: "${itemId}"`);
  res.json({ ok: true, progress: toggleChecklistItem("projectProgress", itemId, done) });
});

export default r;
