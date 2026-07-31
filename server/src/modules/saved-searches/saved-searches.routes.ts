import express from "express";
import { authed } from "../../core/http.js";
import { parseSavedSearchInput } from "../../shared/validation.js";
import { listSavedSearches, createSavedSearch, deleteSavedSearch } from "./saved-searches.repo.js";

const r = express.Router();

// ---------- job alerts (saved searches) ----------
r.get(
  "/saved-searches",
  authed(async (userId, _req, res) => {
    res.json(await listSavedSearches(userId));
  }),
);
r.post(
  "/saved-searches",
  authed(async (userId, req, res) => {
    const input = parseSavedSearchInput(req.body);
    res.status(201).json(await createSavedSearch(userId, input));
  }),
);
r.delete(
  "/saved-searches/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    const deleted = await deleteSavedSearch(userId, id);
    res.json({ ok: true, deleted });
  }),
);

export default r;
