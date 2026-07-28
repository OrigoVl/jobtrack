// Request rate limits. Kept separate from app.ts so modules with expensive LLM endpoints
// can import `aiLimiter` without a circular dependency on app.ts.
//
// Counter storage: by default express-rate-limit keeps counters IN the process's memory
// (no `store` below). This is a deliberately acceptable choice for the current deployment —
// a single Node process backed by a single SQLite file (server/src/db/client.ts), so there's
// no need for separate coordination of limits across instances. If the app ever moves to a
// multi-instance deployment (several replicas behind an LB) — THIS file will need to change
// first: each replica's in-memory counters would stop being shared (the effective limit would
// become N times higher than declared, and each replica would forget other users' counters).
// The fix at that point is to plug in an external store via the `store` option (e.g.
// `rate-limit-redis` + `ioredis`, or any other Store compatible with express-rate-limit),
// synced with whatever Redis/DB persistence has migrated to by then (see the "Migration to
// Postgres" section in the README).
import rateLimit, { type RateLimitExceededEventHandler } from "express-rate-limit";
import { contextLogger } from "./logger.js";

// A shared handler instead of express-rate-limit's default behavior: the default just writes
// res.status(...).json(message) with no logging at all. Without this, a triggered limit
// (especially aiLimiter — a sign of a runaway loop in the frontend or an attempt to burn
// through paid LLM quota) would be visible ONLY to the client (an error toast), leaving no
// trace on the server at all.
function logAndReject(name: string): RateLimitExceededEventHandler {
  return (req, res, _next, options) => {
    contextLogger().warn({ path: req.path, ip: req.ip, limiter: name }, "Rate limit exceeded");
    res.status(options.statusCode).json(options.message);
  };
}

// Protection against runaway loops and abuse of paid LLM calls: a generous limit for a real
// human using the UI, but it stops infinite loops/scripts. Health isn't counted.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: { error: "Too many requests. Try again in a few minutes." },
  handler: logAndReject("api"),
});

// A separate, stricter limit specifically for endpoints that call the LLM (OpenAI/Anthropic).
// Each such request costs real money and a few seconds of provider latency, so the limit is
// much lower than the general `apiLimiter` — so a frontend bug or script can't burn through
// the paid quota in minutes.
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Wait a few minutes and try again." },
  handler: logAndReject("ai"),
});
