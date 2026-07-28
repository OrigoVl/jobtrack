import express from "express";
import { authed } from "../../core/http.js";
import { parseCompanyInput } from "../../shared/validation.js";
import { listCompanies, upsertCompany } from "./companies.repo.js";

const r = express.Router();

// ---------- companies ----------
r.get(
  "/companies",
  authed(async (userId, _req, res) => {
    res.json(await listCompanies(userId));
  }),
);
r.post(
  "/companies",
  authed(async (userId, req, res) => {
    const b = parseCompanyInput(req.body);
    await upsertCompany(userId, b);
    res.json({ ok: true });
  }),
);

export default r;
