---
name: scaffold-module
description: Scaffold a new full-stack domain module for jobtrack (backend module + mirrored frontend feature + query hooks + i18n namespace), following this repo's exact existing conventions. Use when the user asks to add a brand-new domain/feature area (not when extending an existing one — just edit it directly).
---

# Scaffold a new jobtrack module

Scaffolds the full vertical slice for a new domain, end to end, matching the shape of every
existing module in this repo (`server/src/modules/<domain>/` + `client/src/features/<domain>/` +
`client/src/shared/queries/<domain>.ts` + i18n namespace). Don't invent a new shape — copy the
nearest existing module's structure and rename.

## Args

`args` (or ask the user if not given): the domain name in kebab-case (e.g. `saved-searches`) and
a one-line description of what it does.

## Steps

1. **Pick a template module.** Look at the existing modules under `server/src/modules/` and
   `client/src/features/` and pick the smallest one that's shaped like what's being built (a
   simple CRUD domain → `contacts/` or `companies/`; something LLM-backed → `cv/` or `roadmap/`;
   something read-only/aggregating → `analytics/`). Read that module's full file set before
   copying anything.

2. **Backend** — create `server/src/modules/<domain>/`:
   - `<domain>.repo.ts` or `<domain>.service.ts` (name it per the template's convention) — every
     exported function takes `userId: UserId` (from `server/src/db/user-id.ts`) as its first
     argument.
   - `<domain>.routes.ts` — thin, `authed()`-wrapped handlers only (see
     `server/src/core/http.ts`), no business logic.
   - If the domain needs a new table, add it to `server/src/db/schema/` (do NOT hand-write a
     migration file) and then run
     `pnpm --filter jobtrack-server exec drizzle-kit generate` to produce the migration.
   - Wire the new router into `server/src/routes.ts` (the aggregator), following how existing
     modules are mounted.

3. **Frontend** — create `client/src/features/<domain>/`:
   - Mirror the backend module's shape as one or more `.tsx` files.
   - Add query hooks to `client/src/shared/queries/<domain>.ts` — new cache key(s) go in
     `client/src/shared/queries/keys.ts`'s `queryKeys` object, nowhere else.
   - Add a route/nav entry the same way an existing feature is wired into `client/src/app/App.tsx`
     and the sidebar, if the domain needs a page (not every module does — some are
     widgets/panels embedded in an existing page).
   - Every mutation with a network call gets `Btn`'s `loading` prop wired up
     (`client/src/shared/ui.tsx`).

4. **i18n** — create `client/src/i18n/locales/en/<domain>.json` and the matching
   `client/src/i18n/locales/uk/<domain>.json` with the same key shape, both non-empty (don't ship
   an English-only stub). Register the namespace in BOTH:
   - `client/src/i18n/index.ts` (import both locale files, add to the `resources` object)
   - `client/src/i18n/i18next.d.ts` (import the `en` file, add to `CustomTypeOptions.resources`)

   Skipping either registration file means `t()` silently fails to resolve at runtime, or fails
   to typecheck — this is the single most common mistake when adding a module here.

5. **Tests** — hand off to (or invoke) the test-writer agent for the new repo/service file(s), or
   write them directly if the scope is small: a unit test for pure logic, or a PGlite integration
   test (`server/src/db/test-db.ts`) if it's a real repo with Drizzle queries. See existing
   `*.repo.test.ts` files for the pattern.

6. **Verify** — after scaffolding, run `pnpm --filter jobtrack-server typecheck` and
   `pnpm --filter jobtrack-client typecheck` before considering the scaffold done; a missing i18n
   registration or a wrong `UserId` type shows up there immediately.

Keep the scaffold minimal — stub the shape, don't invent business logic beyond what the user
described. This is a starting point for the actual feature work (backend-dev/frontend-dev
agents), not a finished feature.
