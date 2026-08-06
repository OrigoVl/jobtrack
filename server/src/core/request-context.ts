// End-to-end log correlation for a single HTTP request via AsyncLocalStorage: code that
// doesn't have direct access to `req` (the LLM client, services called deep in the stack)
// can still tag its logs with the same reqId as pino-http — critical for diagnostics (e.g.
// "LLM timeout" in prod: without reqId it's unclear which user request this belongs to).
//
// `locale` rides the same mechanism for the same reason: llm/client.ts's chat() (and the
// static-content endpoints) need to know the request's language without every call site along
// the way threading it through as an explicit parameter. Populated by the same middleware in
// app.ts, from the client's X-Locale header (see shared/api.ts, auth-client.ts).
import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_LOCALE, type AppLocale } from "../shared/locale.js";

interface RequestContextStore {
  reqId: string;
  locale: AppLocale;
  // Mutable flags set mid-request by code with no direct access to `res` (llm/client.ts's plan
  // quota check) and read back by app.ts's response middleware to attach an advisory header —
  // one seam instead of threading a signal through every AI route's response shape. Plain
  // object (not a Set) since there's exactly one flag today; add fields here, not a second store.
  flags: { aiQuotaExceeded: boolean };
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Runs `fn` in the context of a specific request — called once from the middleware in app.ts. */
export function runWithRequestContext<T>(reqId: string, locale: AppLocale, fn: () => T): T {
  return storage.run({ reqId, locale, flags: { aiQuotaExceeded: false } }, fn);
}

/** Called by llm/client.ts's plan-quota check when a Free-plan user is over their monthly AI
 * quota — a no-op outside a request context (boot-time code, the scheduler, tests). */
export function markAiQuotaExceeded(): void {
  const store = storage.getStore();
  if (store) store.flags.aiQuotaExceeded = true;
}

/** Read by app.ts's response middleware to decide whether to attach X-AI-Quota-Exceeded. */
export function wasAiQuotaExceeded(): boolean {
  return storage.getStore()?.flags.aiQuotaExceeded ?? false;
}

/** The current request's reqId, if running inside `runWithRequestContext` (otherwise undefined). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.reqId;
}

/** The current request's locale — DEFAULT_LOCALE ("en") outside any request (boot-time code,
 * the scheduler, tests that don't set up a store) so every caller has a safe, defined value
 * without an extra null-check at each of its ~19 call sites. */
export function getLocale(): AppLocale {
  return storage.getStore()?.locale ?? DEFAULT_LOCALE;
}
