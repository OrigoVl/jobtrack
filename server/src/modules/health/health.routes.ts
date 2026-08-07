import express from "express";
import { llmAvailable } from "../../llm/index.js";
import { pingDb } from "../../db/index.js";
import { asyncHandler } from "../../core/http.js";
import { env } from "../../config/env.js";

const r = express.Router();

// Check real DB availability (SELECT 1), not just "the process is alive" — so the orchestrator
// (Docker HEALTHCHECK, k8s liveness/readiness) can tell a stuck/unreachable Postgres apart from
// a genuinely healthy app. 503 instead of 200 if the DB is unavailable.
r.get(
  "/health",
  asyncHandler(async (_q, res) => {
    const dbOk = await pingDb();
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk, llm: llmAvailable() });
  }),
);

// Public (unauthenticated) — the client needs this before a session exists, to know whether to
// render the "Continue with Google"/"Continue with LinkedIn" buttons (see
// client/src/shared/auth-client.ts). Reflects config presence only, never secrets.
r.get("/auth-config", (_q, res) => {
  res.json({ googleEnabled: !!env.auth.google, linkedinEnabled: !!env.auth.linkedin });
});

export default r;
