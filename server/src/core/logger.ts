// Centralized pino logger. In dev — human-readable output via pino-pretty,
// in prod — structured JSON (easily parsed by log aggregators).
import pino from "pino";
import { env } from "../config/env.js";
import { getRequestId } from "./request-context.js";

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
 * A child logger with the current HTTP request's reqId attached (via AsyncLocalStorage), if
 * the code is running inside request handling — otherwise the plain base logger. Use it in
 * code without direct access to `req` (e.g. llm/client.ts) so its logs can be correlated with
 * a specific user request the same way pino-http does for HTTP access logs.
 */
export function contextLogger(): pino.Logger {
  const reqId = getRequestId();
  return reqId ? logger.child({ reqId }) : logger;
}

export default logger;
