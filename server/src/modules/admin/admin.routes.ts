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

// `../../auth/auth.js` imported lazily (dynamic import inside the handler, not a static top-level
// one) — same reasoning as core/http.ts's getSession(): keeps this route module from forcing a
// Postgres connection on every consumer of admin.routes.ts just to reach better-auth's admin
// plugin, which only these two handlers actually need.
r.post(
  "/admin/users/:userId/ban",
  requireAdmin(async (adminUserId, req, res) => {
    const targetUserId = req.params.userId;
    if (!targetUserId) throw new HttpError(400, "Missing user id");
    if (targetUserId === adminUserId) throw new HttpError(400, "You can't ban your own account");
    const banReason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) || undefined : undefined;
    const [{ auth }, { fromNodeHeaders }] = await Promise.all([import("../../auth/auth.js"), import("better-auth/node")]);
    await auth.api.banUser({ body: { userId: targetUserId, banReason }, headers: fromNodeHeaders(req.headers) });
    res.json({ ok: true });
  }),
);
r.post(
  "/admin/users/:userId/unban",
  requireAdmin(async (_adminUserId, req, res) => {
    const targetUserId = req.params.userId;
    if (!targetUserId) throw new HttpError(400, "Missing user id");
    const [{ auth }, { fromNodeHeaders }] = await Promise.all([import("../../auth/auth.js"), import("better-auth/node")]);
    await auth.api.unbanUser({ body: { userId: targetUserId }, headers: fromNodeHeaders(req.headers) });
    res.json({ ok: true });
  }),
);

export default r;
