import express from "express";
import { requireAdmin, HttpError } from "../../core/http.js";
import { parsePagination } from "../../shared/validation.js";
import { getOverview, listUsersWithActivity, getLlmUsageSummary, getProductEventsSummary } from "./admin.service.js";

const r = express.Router();

function parseDays(query: unknown): number {
  const q = (query || {}) as Record<string, unknown>;
  if (!("days" in q)) return 30;
  const n = Number(q.days);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Parameter "days" must be a positive number');
  return Math.min(Math.floor(n), 365);
}

// ---------- admin panel (Phase 6) — every route here requires session.user.role === "admin" ----------
r.get(
  "/admin/overview",
  requireAdmin(async (_userId, req, res) => {
    res.json(await getOverview(parseDays(req.query)));
  }),
);
r.get(
  "/admin/users",
  requireAdmin(async (_userId, req, res) => {
    const { limit, offset } = parsePagination(req.query);
    res.json(await listUsersWithActivity(limit ?? 50, offset));
  }),
);
r.get(
  "/admin/llm-usage",
  requireAdmin(async (_userId, req, res) => {
    res.json(await getLlmUsageSummary(parseDays(req.query)));
  }),
);
r.get(
  "/admin/product-events",
  requireAdmin(async (_userId, req, res) => {
    res.json(await getProductEventsSummary(parseDays(req.query)));
  }),
);

export default r;
