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
import { startSavedSearchesScheduler } from "./modules/saved-searches/saved-searches.scheduler.js";

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

// Phase 2's startup call to bootstrapUser(BOOTSTRAP_USER_ID) lived here before real auth
// existed — removed now that it does: `BOOTSTRAP_USER_ID` was never a real row in better-auth's
// `user` table, so calling it here would violate the FK every table's user_id now has (see
// schema/app.ts). Every real registration seeds its own default profile via
// auth/auth.ts's `databaseHooks.user.create.after` instead — see db/bootstrap.ts's top comment.

const server = app.listen(env.port, () =>
  logger.info(`✅ DevRadar API on http://localhost:${env.port} (LLM: ${env.llm.isAvailable ? "on" : "off — offline mode"})`),
);

// Job alerts (Phase 9) — a single in-process interval, not a queue/worker system (see
// saved-searches.scheduler.ts's top comment for why that's proportional to this app's scale).
const savedSearchesTimer = startSavedSearchesScheduler();

// Graceful shutdown: without a SIGTERM handler (e.g. from `docker stop`) Node kills the
// process immediately, cutting off in-flight requests and leaving the SQLite connection
// unclosed. Here we let http.Server finish requests it already accepted (server.close() stops
// accepting new connections), then cleanly close the DB and exit. forceExitTimer is a safety
// net in case some request hangs.
function shutdown(signal: string): void {
  logger.info(`${signal} received — graceful shutdown…`);
  clearInterval(savedSearchesTimer);
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
