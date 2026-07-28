// Error tracking (Sentry) — optional, just like the LLM keys: no SENTRY_DSN → fully disabled,
// the app keeps logging only through pino (core/logger.ts). Initialized first in index.ts,
// before app.ts is imported, so it can catch errors that occur during the app's own startup.
import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";
import { getRequestId } from "./request-context.js";

// Fields that must NEVER go to Sentry: the request body (may contain CV text — modules/cv/*),
// cookies/headers (session data, once auth is added) — the same risk list already described
// in the redact config of core/logger.ts, except here it shows up NOT as log text but as a
// structured event body.
function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
  }
  return event;
}

// Initialization is a side effect of importing this module itself (not a function someone
// calls later): in ESM all `import`s are evaluated in the order they appear in the file
// BEFORE any of that file's own code (verified empirically) — calling initSentry() as a
// separate statement after `import "./app.js"` would NOT guarantee ordering, because app.ts
// and everything it imports would already have fully run by then. Hence: this module must be
// the FIRST import in server/src/index.ts.
if (env.sentry.isAvailable) {
  Sentry.init({
    dsn: env.sentry.dsn,
    environment: env.nodeEnv,
    release: env.sentry.appVersion,
    // Tracing is disabled by default — a single Node process, and the latency of the one
    // slow dependency (the LLM provider) is already visible via llm/client.ts logs; APM
    // doesn't pay for itself here yet.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      event.tags = { ...event.tags, reqId: getRequestId() };
      return scrubPii(event);
    },
  });
}

/** Attaches a Sentry event to a specific user — called from requireAuth once auth is added. */
export function setSentryUser(userId: string): void {
  if (env.sentry.isAvailable) Sentry.setUser({ id: userId });
}

export function captureException(err: unknown): void {
  if (env.sentry.isAvailable) Sentry.captureException(err);
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (env.sentry.isAvailable) await Sentry.flush(timeoutMs);
}
