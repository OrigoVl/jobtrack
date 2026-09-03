// Centralized pino logger. In dev — human-readable output via pino-pretty,
// in prod — structured JSON (easily parsed by log aggregators).
import pino from "pino";
import { env } from "../config/env.js";
import { getContextUserId, getRequestId } from "./request-context.js";

const logger = pino({
  level: env.logLevel,
  // Default protection against secrets accidentally ending up in logs (e.g. if auth is
  // added later and someone carelessly logs the whole `req`, or pino-http's default request
  // auto-logging serializes request headers). Applied globally to ALL logs (both pino-http
  // access logs and contextLogger()) — consistent with the project rule of "never log
  // secrets/tokens/passwords/auth headers".
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      "*.apiKey",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});

/**
 * A child logger with the current HTTP request's reqId (and, once core/http.ts's authed()/
 * requireAdmin() has resolved a session, userId) attached via AsyncLocalStorage, if the code is
 * running inside request handling — otherwise the plain base logger. Use it in code without
 * direct access to `req` (e.g. llm/client.ts) so its logs can be correlated with a specific user
 * request the same way pino-http does for HTTP access logs, and grepped by userId the same way
 * Sentry events already can be (core/sentry.ts's setSentryUser()).
 */
export function contextLogger(): pino.Logger {
  const reqId = getRequestId();
  const userId = getContextUserId();
  const bindings: Record<string, string> = {};
  if (reqId) bindings.reqId = reqId;
  if (userId) bindings.userId = userId;
  return Object.keys(bindings).length > 0 ? logger.child(bindings) : logger;
}

export default logger;
