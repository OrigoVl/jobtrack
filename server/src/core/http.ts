// A single HTTP error type + wrappers for async routes (Express doesn't catch rejections on its own).
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { type UserId, BOOTSTRAP_USER_ID } from "../db/user-id.js";

export class HttpError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

type AuthedRequestHandler = (userId: UserId, req: Request, res: Response) => Promise<unknown>;

// The single seam between "who is making this request" and every route/repository. Right now
// (phase 2 of the multi-tenant migration, before better-auth exists) it always resolves to the
// one bootstrap user — phase 3 changes ONLY the line inside this function to read a real user
// id off the better-auth session instead. No repository and no route ever imports a session or
// reads req.user directly; they all go through the `userId` this function hands them.
//
// Deliberately explicit-parameter, not AsyncLocalStorage: an ALS-scoped userId is invisible at
// the call site — a repository function that forgets to filter by it still compiles and
// silently returns every user's rows, and no type checker catches that. A required `userId:
// UserId` argument turns "forgot to scope this query" into a compile error instead.
export function authed(fn: AuthedRequestHandler): RequestHandler {
  return asyncHandler(async (req, res) => {
    const userId: UserId = BOOTSTRAP_USER_ID;
    await fn(userId, req, res);
  });
}
