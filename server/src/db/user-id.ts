// A branded string type for user ids — produced ONLY by `authed()` (server/src/core/http.ts).
// This makes it a compile error to pass a loose string (a URL param, a company name, anything
// not actually resolved from a real session) anywhere a repository expects a tenant scope. The
// brand has no runtime cost — it's erased by TypeScript, this is purely a type-checker guardrail.
export type UserId = string & { readonly __brand: "UserId" };

// Phase 2 of the multi-tenant migration used this constant as every request's `userId` — there
// was no real session yet, so `authed()` (core/http.ts) always resolved to it. Phase 3
// (better-auth) replaced that with the real session user id; `authed()` no longer reads this
// constant at all. It's kept only as the well-known id that any pre-auth data (seeded/migrated
// while this was still the only "user") is scoped under — see
// server/scripts/claim-bootstrap-data.mjs, which reassigns it to a real registered account.
export const BOOTSTRAP_USER_ID = "bootstrap-user" as UserId;
