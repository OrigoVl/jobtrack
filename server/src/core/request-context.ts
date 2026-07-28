// End-to-end log correlation for a single HTTP request via AsyncLocalStorage: code that
// doesn't have direct access to `req` (the LLM client, services called deep in the stack)
// can still tag its logs with the same reqId as pino-http — critical for diagnostics (e.g.
// "LLM timeout" in prod: without reqId it's unclear which user request this belongs to).
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContextStore {
  reqId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Runs `fn` in the context of a specific request — called once from the middleware in app.ts. */
export function runWithRequestContext<T>(reqId: string, fn: () => T): T {
  return storage.run({ reqId }, fn);
}

/** The current request's reqId, if running inside `runWithRequestContext` (otherwise undefined). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.reqId;
}
