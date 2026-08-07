import express from "express";
import { authed, HttpError } from "../../core/http.js";
import { parseCompanyInput } from "../../shared/validation.js";
import {
  deleteCompany,
  findCompanyByName,
  listCompanies,
  updateCompany,
  upsertCompany,
  upsertCompanyEnrichment,
} from "./companies.repo.js";

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

// Auto-created-from-a-vacancy-link sibling of POST /companies above — same body, but it never
// overwrites notes/questions/website a user already filled in, and it returns the row so the
// caller can link the vacancy to it (POST /companies deliberately keeps its `{ok:true}` shape).
// Declared before "/companies/:id" is irrelevant here (that one is PUT/DELETE only), but it stays
// above them anyway so a future POST /companies/:id can't quietly shadow this path.
r.post(
  "/companies/enrich",
  authed(async (userId, req, res) => {
    res.json(await upsertCompanyEnrichment(userId, parseCompanyInput(req.body)));
  }),
);

r.put(
  "/companies/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid company id");
    const b = parseCompanyInput(req.body);
    const nameOwner = await findCompanyByName(userId, b.name);
    if (nameOwner && nameOwner.id !== id) throw new HttpError(409, `Company name already in use: ${b.name}`, null, "COMPANY_NAME_TAKEN");
    const updated = await updateCompany(userId, id, b);
    if (!updated) throw new HttpError(404, `Unknown company: ${id}`, null, "COMPANY_NOT_FOUND");
    res.json(updated);
  }),
);

r.delete(
  "/companies/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid company id");
    const deleted = await deleteCompany(userId, id);
    res.json({ ok: true, deleted });
  }),
);

export default r;
