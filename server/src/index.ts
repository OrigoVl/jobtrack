// Entry point: starts the HTTP server on top of the assembled app (app.ts).
// core/sentry.js — deliberately the FIRST import: Sentry initialization is a side effect of
// the import itself (see the comment in that file), so it must run before app.ts and
// everything it pulls in is evaluated — otherwise an error during app startup wouldn't
// reach Sentry.
import { captureException, flushSentry } from "./core/sentry.js";

import { app } from "./app.js";
import { env } from "./config/env.js";
import logger from "./core/logger.js";
import { closeDb } from "./db/index.js";
import { bootstrapUser } from "./db/bootstrap.js";
import { BOOTSTRAP_USER_ID } from "./db/user-id.js";

// Without these two handlers, an unexpected exception outside an Express request (e.g. a
// throw in setTimeout/a background timer, or an unhandled Promise rejection from code nobody
// awaited) would either fall through with an unstructured stack trace straight to stderr
// (Node's default), or — on newer Node versions — kill the process immediately without any
// chance to log the cause in a structured way (with reqId/context, like everything else in
// the app does via pino).
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  captureException(reason);
});
process.on("uncaughtException", (err) => {
  // uncaughtException — a signal that process state may already be unpredictable (corrupted
  // closures/resources). Node best practice: log with maximum context and TERMINATE the
  // process (rather than "healing" and continuing) — a supervisor (Docker/pm2/systemd) will
  // start a new one. Flush before exit — otherwise the Sentry event never makes it out
  // (the process exits first).
  logger.fatal({ err }, "Uncaught exception — shutting down");
  captureException(err);
  void flushSentry().finally(() => process.exit(1));
});

// Phase 2 of the multi-tenant migration: there's no real registration flow yet (phase 3 adds
// better-auth), so the one bootstrap user is seeded explicitly here, before the server starts
// accepting requests — instead of the old node:sqlite version's import-time side effect against
// a single shared file, which doesn't generalize to "seed if this user has nothing yet".
await bootstrapUser(BOOTSTRAP_USER_ID);

const server = app.listen(env.port, () =>
  logger.info(`✅ JobTrack API on http://localhost:${env.port} (LLM: ${env.llm.isAvailable ? "on" : "off — offline mode"})`),
);

// Graceful shutdown: without a SIGTERM handler (e.g. from `docker stop`) Node kills the
// process immediately, cutting off in-flight requests and leaving the SQLite connection
// unclosed. Here we let http.Server finish requests it already accepted (server.close() stops
// accepting new connections), then cleanly close the DB and exit. forceExitTimer is a safety
// net in case some request hangs.
function shutdown(signal: string): void {
  logger.info(`${signal} received — graceful shutdown…`);
  const forceExitTimer = setTimeout(() => {
    logger.warn("Graceful shutdown did not complete within 10s — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();
  server.close((err) => {
    if (err) logger.error({ err }, "Error while closing the HTTP server");
    void closeDb()
      .catch((closeErr) => logger.error({ err: closeErr }, "Error while closing the DB pool"))
      .finally(() => void flushSentry().finally(() => process.exit(err ? 1 : 0)));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
