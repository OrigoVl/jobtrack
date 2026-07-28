import express from "express";
import { llmAvailable } from "../../llm/index.js";
import { pingDb } from "../../db/index.js";

const r = express.Router();

// Check real DB availability (SELECT 1), not just "the process is alive" — so the orchestrator
// (Docker HEALTHCHECK, k8s liveness/readiness) can tell a stuck/corrupted SQLite file apart from
// a genuinely healthy app. 503 instead of 200 if the DB is unavailable.
r.get("/health", (_q, res) => {
  const dbOk = pingDb();
  res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk, llm: llmAvailable() });
});

export default r;
