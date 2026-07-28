// Request rate limits. Kept separate from app.ts so modules with expensive LLM endpoints
// can import `aiLimiter` without a circular dependency on app.ts.
//
// Counter storage: without REDIS_URL, express-rate-limit keeps counters IN the process's own
// memory — correct for a single instance, but each replica of a multi-instance deployment
// would stop sharing counters with the others (the effective limit becomes N times higher than
// declared, and each replica forgets other replicas' counters). With REDIS_URL set, both
// limiters below share counters through Redis instead, so the declared limit holds regardless
// of how many replicas are running.
import rateLimit, { type RateLimitExceededEventHandler, type Store } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { contextLogger } from "./logger.js";

// A single shared Redis connection for both limiters below (not one per limiter) — no reason
// to open two sockets to the same server for the same purpose. `undefined` when REDIS_URL
// isn't set, so `sharedStore()` falls back to express-rate-limit's own in-memory default.
const redis = env.redisUrl ? new Redis(env.redisUrl) : undefined;

if (redis) {
  // Rate limiting is a best-effort protection, not a correctness guarantee — a Redis hiccup
  // must not take the whole API down. ioredis retries connections on its own; this just stops
  // an unhandled 'error' event from crashing the process (the default Node behavior for
  // EventEmitter 'error' with no listener).
  redis.on("error", (err: Error) => contextLogger().error({ err }, "Redis connection error (rate limiting)"));
}

// `prefix` keeps the two limiters' keys from colliding in the same Redis keyspace (they'd
// otherwise both write to keys like "rl:<ip>" and corrupt each other's counts).
function sharedStore(prefix: string): Store | undefined {
  return redis
    ? new RedisStore({ sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>, prefix })
    : undefined;
}

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
  store: sharedStore("rl:api:"),
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
  store: sharedStore("rl:ai:"),
});
