// Request rate limits. Kept separate from app.ts so modules with expensive LLM endpoints
// can import `aiLimiter` without a circular dependency on app.ts.
//
// Counter storage: without REDIS_URL, express-rate-limit keeps counters IN the process's own
// memory — correct for a single instance, but each replica of a multi-instance deployment
// would stop sharing counters with the others (the effective limit becomes N times higher than
// declared, and each replica forgets other replicas' counters). With REDIS_URL set, both
// limiters below share counters through Redis instead, so the declared limit holds regardless
// of how many replicas are running.
import rateLimit, { ipKeyGenerator, type RateLimitExceededEventHandler, type Store } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import { Redis } from "ioredis";
import type { Request } from "express";
import { env } from "../config/env.js";
import { contextLogger } from "./logger.js";
import { getSessionUserIdForRateLimit } from "./http.js";

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

// Per-account key when the request has a valid session, falling back to per-IP (via
// express-rate-limit's own ipKeyGenerator, which correctly normalizes/subnets IPv6) for
// unauthenticated requests. Without this, every user behind the same office/VPN/NAT IP shares one
// bucket — a single heavy user throttles everyone else on that address, and there's no way to
// give one abusive ACCOUNT a tighter limit independent of who else is on their network. This is
// the one sanctioned second caller of the session lookup outside authed()/requireAdmin()
// themselves (see http.ts's getSessionUserIdForRateLimit).
//
// Deliberately used ONLY by aiLimiter below, not apiLimiter: apiLimiter is mounted globally on
// every "/api/*" request (app.ts), so keying it this way would add a second session lookup to
// literally every request in the app (on top of the one authed() already does once the handler
// runs) — real added latency/DB load for a limiter whose job is just a coarse anti-runaway-loop
// backstop, where IP bucketing is an acceptable tradeoff. aiLimiter only gates a small, bounded
// set of expensive LLM endpoints, where one extra fast auth lookup is negligible next to the
// multi-second LLM call it precedes, and per-account keying is exactly what the shared-IP
// AI-cost-throttling problem needs.
async function perAccountKey(req: Request): Promise<string> {
  const userId = await getSessionUserIdForRateLimit(req);
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

// A shared handler instead of express-rate-limit's default behavior: the default just writes
// res.status(...).json(message) with no logging at all. Without this, a triggered limit
// (especially aiLimiter — a sign of a runaway loop in the frontend or an attempt to burn
// through paid LLM quota) would be visible ONLY to the client (an error toast), leaving no
// trace on the server at all.
// `resolveKey` mirrors whatever this specific limiter actually bucketed the request by (IP for
// apiLimiter, per-account for aiLimiter) — logging a resolved account key here for a limiter
// that never used one for bucketing would misleadingly suggest it was.
function logAndReject(name: string, resolveKey: (req: Request) => string | Promise<string>): RateLimitExceededEventHandler {
  return (req, res, _next, options) => {
    // Only runs on the rare rejected-request path, so re-deriving the key here (for aiLimiter,
    // the same lookup perAccountKey() already did once for bucketing) is not a hot-path cost.
    void Promise.resolve(resolveKey(req)).then((key) => {
      contextLogger().warn({ path: req.path, key, limiter: name }, "Rate limit exceeded");
    });
    res.status(options.statusCode).json(options.message);
  };
}

// Protection against runaway loops and abuse of paid LLM calls: a generous limit for a real
// human using the UI, but it stops infinite loops/scripts. Health isn't counted.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  // `code` mirrors HttpError's optional 4th param (core/http.ts) even though this response never
  // goes through errorHandler — express-rate-limit's handler writes `options.message` directly —
  // so the client (shared/use-error-toast.ts) can map it to a translated message the same way.
  message: { error: "Too many requests. Try again in a few minutes.", code: "RATE_LIMITED" },
  handler: logAndReject("api", (req) => `ip:${ipKeyGenerator(req.ip ?? "unknown")}`),
  // IP-keyed (express-rate-limit's default) — see perAccountKey's comment for why this one stays
  // IP-based while aiLimiter below doesn't.
  store: sharedStore("rl:api:"),
});

// An unauthenticated caller never actually reaches an AI route's handler (every one is wrapped
// in authed(), which 401s first) — this only bounds the brief window where aiLimiter itself runs
// before that check does, so it doesn't need to track any plan.
const ANONYMOUS_AI_RATE_LIMIT = 10;
// Free's own rate limit, kept as a plain constant here (not read from modules/billing/plans.ts)
// so this file's only dependency on the billing module is the single LAZY import below — this
// is the value returned when that import/lookup fails, matching the module's own default.
const FREE_AI_RATE_LIMIT = 30;

// `../modules/billing/entitlements.js` is imported LAZILY (dynamic import inside the function
// below, not a static top-level one) for the exact reason http.ts's getSession() is: it
// transitively imports billing.repo.ts's static `db/client.js`, which opens a real Postgres
// pool (and runs migrate-on-boot) as an import-time side effect. A static import here would
// force rate-limit.test.ts's `vi.resetModules()` + dynamic `import("./rate-limit.js")` to open a
// real DB connection just to check that apiLimiter/aiLimiter are constructible.
async function aiRateLimitForRequest(req: Request): Promise<number> {
  const userId = await getSessionUserIdForRateLimit(req);
  if (!userId) return ANONYMOUS_AI_RATE_LIMIT;
  try {
    const { getEntitlements } = await import("../modules/billing/entitlements.js");
    return (await getEntitlements(userId)).aiRateLimit;
  } catch (err) {
    // Fail open to the Free default rather than let a billing-table hiccup break AI rate
    // limiting entirely — same fail-open bias as llm/client.ts's plan-quota check.
    contextLogger().error({ err, userId }, "Failed to resolve plan for AI rate limit — using the Free default");
    return FREE_AI_RATE_LIMIT;
  }
}

// A separate, stricter limit specifically for endpoints that call the LLM (OpenAI/Anthropic).
// Each such request costs real money and a few seconds of provider latency, so the limit is
// much lower than the general `apiLimiter` — so a frontend bug or script can't burn through
// the paid quota in minutes. The ceiling itself now varies by plan (Free stays at the original
// hardcoded 30 — byte-identical to before when billing is unconfigured — Pro/Team get more
// headroom); see aiRateLimitForRequest above. express-rate-limit compares the CURRENT count
// against whatever `limit` returns on THIS request, so an upgrade takes effect on the very next
// request with no cache to invalidate.
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: aiRateLimitForRequest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Wait a few minutes and try again.", code: "AI_RATE_LIMITED" },
  handler: logAndReject("ai", perAccountKey),
  keyGenerator: perAccountKey,
  store: sharedStore("rl:ai:"),
});
