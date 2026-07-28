// A branded string type for user ids — produced ONLY by `authed()` (server/src/core/http.ts).
// This makes it a compile error to pass a loose string (a URL param, a company name, anything
// not actually resolved from a real session) anywhere a repository expects a tenant scope. The
// brand has no runtime cost — it's erased by TypeScript, this is purely a type-checker guardrail.
export type UserId = string & { readonly __brand: "UserId" };

// Phase 2 of the multi-tenant migration (Postgres schema + async repositories) lands before
// phase 3 (better-auth), so there is no real session yet — every request is scoped to this one
// constant "bootstrap" user, and the app keeps behaving exactly like the single-user tool it is
// today. `authed()` is the ONLY place that reads this constant; once better-auth exists, that
// one function starts returning the session's real user id instead — no repository, no route,
// and no call site anywhere else has to change.
export const BOOTSTRAP_USER_ID = "bootstrap-user" as UserId;
