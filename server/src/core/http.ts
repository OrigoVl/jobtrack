// A single HTTP error type + wrappers for async routes (Express doesn't catch rejections on its own).
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserId } from "../db/user-id.js";
import { setContextUserId } from "./request-context.js";

export class HttpError extends Error {
  status: number;
  details: unknown;
  // Stable machine-readable identifier (UPPER_SNAKE_CASE) for the handful of error sites a
  // normal user can actually trigger and see as a toast — lets the client map the error to a
  // translated message (client/src/shared/use-error-toast.ts) instead of showing the raw,
  // untranslated English `message` string. Optional: most of the ~60 other HttpError sites are
  // edge cases that don't need a code and just fall back to `message`.
  code?: string;

  constructor(status: number, message: string, details: unknown = null, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

type AuthedRequestHandler = (userId: UserId, req: Request, res: Response) => Promise<unknown>;

// `../auth/auth.js` is imported lazily (dynamic import inside the function, not a static
// top-level one) purely to keep the module graph light: it pulls in db/client.ts, which opens a
// real Postgres connection pool and runs migrate-on-boot as a side effect of being imported.
// core/http.ts's HttpError/asyncHandler are used by dozens of otherwise DB-free modules
// (validation.ts, pure services, ...) and their unit tests — a static import here would force
// every one of them to either open a real DB connection or mock this file, for a dependency
// they never actually use. Node caches the dynamic import after the first call, so this has no
// meaningful runtime cost beyond the very first request.
async function getSession(req: Request) {
  const [{ auth }, { fromNodeHeaders }] = await Promise.all([import("../auth/auth.js"), import("better-auth/node")]);
  return auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
}

// Same lazy-import rationale as getSession()'s own doc comment, for a different reason:
// core/sentry.ts pulls in config/env.js at module-load time (to read SENTRY_DSN and call
// Sentry.init()), and several unit tests (e.g. billing.service.test.ts) `vi.mock("../../config/
// env.js", ...)` with a factory that reads local top-level consts declared AFTER their `import {
// HttpError } from "../../core/http.js"` — a static top-level import of sentry.js here would
// force that mock factory to run during those imports' own evaluation, before the consts it
// closes over are initialized (a TDZ crash), even though those tests never call authed()/
// requireAdmin() at all.
async function tagSentryUser(userId: UserId): Promise<void> {
  const { setSentryUser } = await import("./sentry.js");
  setSentryUser(userId);
}

// Memoizes the resolved id ON THE REQUEST OBJECT (a Symbol-keyed property, not a WeakMap — a
// single Express Request is never reused across requests, so there's no cross-request leak to
// worry about). aiLimiter now calls this twice per request — once as `keyGenerator`, once inside
// `limit` (core/rate-limit.ts's aiRateLimitForRequest, to resolve the caller's plan) — and this
// keeps that at one actual session lookup instead of two, on top of authed()'s own.
const cachedUserIdKey = Symbol("rateLimitUserId");
type RequestWithCachedUserId = Request & { [cachedUserIdKey]?: Promise<UserId | null> };

/** The one narrow, sanctioned exception to "authed()/requireAdmin() are the only place a
 * session is read": core/rate-limit.ts calls this to key the AI/API limiters per-account instead
 * of per-IP (important once more than one user shares an office/VPN IP — a multi-user prerequisite).
 * Deliberately returns ONLY the id, never the full session/role, since bucketing a rate limit is
 * all it's for — every actual authorization decision still goes exclusively through
 * authed()/requireAdmin() below, and no repository or route ever receives a `userId` this way.
 * A second, equally-deliberate resolver exists alongside this one: modules/mcp/mcp.routes.ts's
 * bearer-auth verifier resolves a `UserId` from a personal API token (not a session) for MCP
 * clients — same "no ad hoc userId" invariant, just a different, documented credential. */
export async function getSessionUserIdForRateLimit(req: Request): Promise<UserId | null> {
  const cached = (req as RequestWithCachedUserId)[cachedUserIdKey];
  if (cached) return cached;
  const promise = getSession(req).then((session) => (session ? (session.user.id as UserId) : null));
  (req as RequestWithCachedUserId)[cachedUserIdKey] = promise;
  return promise;
}

// The single seam between "who is making this request" and every route/repository — the ONLY
// place that reads a better-auth session. No repository and no route ever imports a session or
// reads req.user directly; they all go through the `userId` this function hands them.
//
// Deliberately explicit-parameter, not AsyncLocalStorage, for AUTHORIZATION: an ALS-scoped
// userId is invisible at the call site — a repository function that forgets to filter by it
// still compiles and silently returns every user's rows, and no type checker catches that. A
// required `userId: UserId` argument turns "forgot to scope this query" into a compile error
// instead. The setContextUserId()/tagSentryUser() calls below are a SEPARATE, observability-only
// use of ALS — they let contextLogger() (core/logger.ts) and Sentry events tag themselves with
// the userId this function already resolved, without changing how that id reaches services/
// repositories (still exclusively the explicit `userId` argument passed to `fn` below).
export function authed(fn: AuthedRequestHandler): RequestHandler {
  return asyncHandler(async (req, res) => {
    const session = await getSession(req);
    if (!session) throw new HttpError(401, "Not authenticated");
    const userId = session.user.id as UserId;
    setContextUserId(userId);
    await tagSentryUser(userId);
    await fn(userId, req, res);
  });
}

// Same seam as authed(), plus a role check — for admin-only routes (server/src/modules/admin/*,
// phase 6). 403 (not a redirect/silent 200) so the client can tell "not logged in" (401) apart
// from "logged in but not an admin" (403).
export function requireAdmin(fn: AuthedRequestHandler): RequestHandler {
  return asyncHandler(async (req, res) => {
    const session = await getSession(req);
    if (!session) throw new HttpError(401, "Not authenticated");
    if (session.user.role !== "admin") throw new HttpError(403, "Admin access required");
    const userId = session.user.id as UserId;
    setContextUserId(userId);
    await tagSentryUser(userId);
    await fn(userId, req, res);
  });
}
