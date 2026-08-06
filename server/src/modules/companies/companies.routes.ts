import express from "express";
import { authed, HttpError } from "../../core/http.js";
import { parseCompanyInput, parseDesignDiagramInput } from "../../shared/validation.js";
import type { UserId } from "../../db/user-id.js";
import { getCompanyById, getCompanyDiagram, listCompanies, setCompanyDiagram, upsertCompany } from "./companies.repo.js";

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

// ---------- company system-architecture diagram (reuses the design trainer's canvas, no task/
// grading involved — see companies.repo.ts's own comment on why this is user_kv, not a column) ----------
async function assertOwnCompany(userId: UserId, id: number) {
  const company = await getCompanyById(userId, id);
  if (!company) throw new HttpError(404, `Unknown company: ${id}`);
}

r.get(
  "/companies/:id/diagram",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid company id");
    await assertOwnCompany(userId, id);
    res.json(await getCompanyDiagram(userId, id));
  }),
);

r.put(
  "/companies/:id/diagram",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid company id");
    await assertOwnCompany(userId, id);
    const diagram = parseDesignDiagramInput(req.body);
    await setCompanyDiagram(userId, id, diagram);
    res.json(diagram);
  }),
);

export default r;
