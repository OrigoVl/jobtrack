import express from "express";
import db, { type CompanyRow, j } from "../../db/index.js";
import { parseCompanyInput } from "../../shared/validation.js";

const r = express.Router();

// ---------- companies ----------
r.get("/companies", (_q, res) =>
  res.json(
    (db.prepare("SELECT * FROM companies ORDER BY name").all() as unknown as CompanyRow[]).map((c) => ({ ...c, questions: j(c.questions) })),
  ),
);
r.post("/companies", (req, res) => {
  const b = parseCompanyInput(req.body);
  db.prepare("INSERT INTO companies (name,notes,questions) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET notes=?,questions=?").run(
    b.name,
    b.notes,
    JSON.stringify(b.questions),
    b.notes,
    JSON.stringify(b.questions),
  );
  res.json({ ok: true });
});

export default r;
