// Єдиний обробник помилок Express — консистентний формат відповіді {error, details}
// для будь-якої помилки в застосунку (HttpError, MulterError, несподівані винятки).
import type { NextFunction, Request, Response } from "express";
import logger from "./logger.js";

export interface AppError extends Error {
  status?: number;
  details?: unknown;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  let status = err.status || 500;
  if (err.name === "MulterError") status = 400;
  if (status >= 500) (req.log || logger).error({ err }, "API error");
  res.status(status).json({ error: err.message || "Внутрішня помилка", details: err.details ?? undefined });
}
