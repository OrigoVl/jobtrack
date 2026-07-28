// Single Express error handler — a consistent {error, details} response format
// for any error in the app (HttpError, MulterError, unexpected exceptions).
import type { NextFunction, Request, Response } from "express";
import logger from "./logger.js";
import { captureException } from "./sentry.js";

export interface AppError extends Error {
  status?: number;
  details?: unknown;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  let status = err.status || 500;
  if (err.name === "MulterError") status = 400;
  if (status >= 500) {
    (req.log || logger).error({ err }, "API error");
    // Only 5xx — expected 4xx (validation, HttpError from business logic) are not "app
    // errors" and would clutter Sentry with noise instead of signaling real failures.
    captureException(err);
  }
  res.status(status).json({ error: err.message || "Internal error", details: err.details ?? undefined });
}
