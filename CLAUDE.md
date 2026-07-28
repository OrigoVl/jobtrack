# CLAUDE.md

Guidance for Claude (Claude Code or any AI agent) working in this repository. For features,
setup, architecture and security details see **`README.md`** — don't duplicate that here, this
file is only about *how to work* in this codebase.

## Stack

React + TypeScript (Vite) client, Node.js + Express + TypeScript server, SQLite (`node:sqlite`,
no ORM), optional LLM (OpenAI/Anthropic) with graceful offline fallback everywhere. pnpm
workspace monorepo: `client/`, `server/`. Node **≥ 22.5** required.

## Commands (run from repo root)

```bash
pnpm install          # installs both workspaces
pnpm dev               # server :3001 + client :5173, concurrently
pnpm lint              # eslint, both workspaces
pnpm typecheck         # tsc --noEmit, both workspaces
pnpm test              # vitest unit/component tests, both workspaces
pnpm test:coverage     # same + v8 coverage report (CI enforces baseline thresholds)
pnpm build             # client build → client/dist, then server tsc build
pnpm test:e2e          # Playwright — requires `pnpm build` first, runs against prod build
pnpm format            # prettier --write .
pnpm format:check      # prettier --check . (CI fails if this fails)
```

`husky` + `lint-staged` run `prettier --write` on staged files automatically on `git commit` —
don't skip this with `--no-verify` unless you have a good reason.

## Before considering any change done

Run, in this order, and make sure all are green:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test` (add/update unit tests for new logic — see "Testing philosophy" below)
4. `pnpm build`
5. `pnpm test:e2e` if the change touches a flow already covered by `e2e/*.spec.ts`, or add a new
   spec if you added a new critical user-facing flow.

Don't declare a task finished on the basis of "it should work" — actually run the above.

## Architecture conventions (match existing patterns, don't refactor drive-by)

- **Backend**: feature-based modules in `server/src/modules/<domain>/`. Each module: thin
  `*.routes.ts` (parse request → delegate → respond, no business logic) + `*.service.ts`/
  `*.data.ts` (business logic, unit-testable without Express). Cross-cutting stuff lives in
  `core/` (http/logger/error-handler), `db/`, `llm/`, `shared/`, `config/env.ts`.
- **Frontend**: `client/src/features/<domain>/` mirrors the server's `modules/<domain>/`. Data
  fetching/mutations go through `client/src/shared/queries/*` (TanStack Query hooks, one per
  domain, typed cache keys). No global "god context" — pages subscribe only to what they need.
- **Env vars**: never read `process.env` directly outside `server/src/config/env.ts` — add new
  vars to the Zod schema there, they're validated fail-fast at startup.
- **LLM calls**: use `chat()` (`server/src/llm/client.ts`) for plain text, `chatJson<T>(system,
  user, zodSchema, options)` for structured JSON output — it validates with the schema and does
  one self-repair retry on mismatch, don't hand-roll `typeof`/`Array.isArray` narrowing for new
  LLM JSON call sites. Always gate LLM calls behind `llmAvailable()` with a deterministic offline
  fallback — every AI feature in this app must work without a key.
- **Validation**: Zod for external input (env vars, DTOs). SQLite queries are always parameterized.
- **Every mutation that does a network call needs a loading indicator** — use `Btn`'s `loading`
  prop (`client/src/shared/ui.tsx`), scoped to the specific row/card via
  `mutation.isPending && mutation.variables === …` when one hook serves many list items.
- **No authentication** in this app (single-user, intentional — see README "Security"). Don't add
  auth speculatively; it's a planned separate migration (Postgres + JWT), not a small patch.

## Testing philosophy

- Unit tests (`vitest`) for **business logic** (services, algorithms, utils) — aim for high
  coverage there. `*.routes.ts` files are intentionally NOT unit-tested (thin by design); their
  behavior is covered by `e2e/*.spec.ts` instead.
- E2E (Playwright) always runs with LLM **offline** (no API keys in CI) for determinism and
  speed — don't write e2e tests that require a real LLM response.
- New algorithmic/business logic → add a `.test.ts` next to it. New critical user flow → consider
  an e2e spec.

## Style

- TypeScript strict mode, `noUncheckedIndexedAccess` on the server — no `any` (use `unknown` +
  type guards or a Zod schema).
- Minimal diffs; match existing naming/module structure; no drive-by refactors unrelated to the
  task at hand.
- Don't add new dependencies unless the task explicitly calls for it — this codebase deliberately
  favors small, hand-rolled solutions (e.g. `chatJson`'s Zod-based retry instead of an LLM SDK/
  orchestrator) over heavier frameworks when the simpler approach covers the actual need.
