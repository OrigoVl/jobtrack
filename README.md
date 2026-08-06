# Zorya — a dynamic job-search tracker (React + Node + Postgres + AI)

A full-featured, lightweight full-stack app: **analyzes job postings and CVs, surfaces skill gaps and market demand, drills you for interviews, and helps with your resume/cover letters.** Stack: **React + TypeScript + Node.js + Postgres/Drizzle (+ optional LLM)**.

> **Requirement:** Node.js **24 LTS recommended**. **Postgres** for the database — `docker compose up -d postgres` is the fastest way to get one locally (see "Docker" below), or point `DATABASE_URL` at any Postgres instance.
> **Package manager:** [pnpm](https://pnpm.io) (workspace monorepo `client` + `server`). Install with: `corepack enable` or `npm i -g pnpm`.

## What it does

- **🌐 Any profession** — with an LLM, skills and role are inferred from the CV and job postings (not just IT), and AI advice adapts accordingly. Offline — falls back to an IT tech dictionary.
- **🇺🇦 English / Ukrainian** — a language switcher (sidebar, or the Account page) that translates every page, toast, and email, plus AI-generated feedback and the study/knowledge-base content, with the choice persisted across reloads.
- **📋 Job postings** — CRUD, inline table editing, color-coded status (table + Kanban), auto-fills stack/level/fit from a URL (from any public job site) when adding/editing a link, import from a DOU export, JSON import/export (upsert by `url`/company+position).
- **🔔 Reminders** — optional browser Web Notifications for overdue/today's "next steps."
- **🔍 Job analysis** — skills and level (LLM or offline dictionary), match/gaps against your profile, semantic CV↔job similarity (embeddings, with an OpenAI key).
- **🎯 Skill radar** — "your skills vs. market demand" from the actual stack of jobs you've added (recency-weighted).
- **📊 Analytics** — application funnel (current + "ever reached this stage"), stage-to-stage conversion, average time in status, technology demand.
- **🧠 Study** — FSRS-based flashcards (like Anki) + drill mode (89 tasks: JS/TS/React/SQL/Node/NestJS/algorithms/system design), a JS sandbox, AI hints, card/task generation tailored to your role, track-specific content (frontend/backend/QA/DevOps/security/sysadmin/product/design).
- **🎨 Design trainer** — system-design exercises on an interactive node canvas, AI-graded, with a "defense" follow-up-question mode and reference solutions.
- **🎤 Mock interviews** — a random set of questions and tasks with a timer, optional voice mode (speech-to-text answers, cloud or browser TTS for questions), and AI-scored answers.
- **🗺️ Roadmap** — a roadmap.sh-style skill map built from your real tracked stack, with a self-rated skill radar chart.
- **📅 21-Day Intensive** — a dynamic study plan closing the gap between your CV and the jobs you're tracking.
- **🧩 Pet projects** — a ladder of 4 projects with Definition-of-Done checklists.
- **📄 CV** — analysis against market demand, a Skills generator, cover letters (manual text / picked from the tracker / auto-fetched from a link), a CV Builder with a live preview, PDF export, and **multiple named CV profiles** (up to 5, tab strip) — each with its own layout/theme presets and its own public share link.
- **🔗 Public CV link** — a shareable, no-login resume page per CV profile (enable/disable, regenerate the slug any time).
- **🏢 Companies** — notes, a bank of "what they asked here" questions, and an AI-assisted org-chart diagram.
- **🧑‍🤝‍🧑 Contacts** — a lightweight networking tracker (recruiters/interviewers), optionally linked to a company/vacancy, with AI-drafted outreach/follow-up messages.
- **📅 Calendar** — a unified view of interviews/deadlines/reminders (manual entries + vacancy next-steps + SRS due-cards), with optional browser notifications.
- **📬 Job alerts** — saved searches (query + region) re-run on a schedule, emailing you newly-appeared postings.
- **📧 Weekly digest** — an opt-in email summary (stale applications, study streak, upcoming interviews).
- **📲 Telegram notifications** — link your account to a Telegram bot as an alternative channel for the digest/job-alert notifications.
- **🗂 Job Kanban** — drag-and-drop between statuses (keyboard-accessible too).
- **💳 Billing** — optional Stripe subscriptions (free tier with an AI-call quota, paid tier with a fair-use cost ceiling) — inert until Stripe keys are configured.

## Quick start

```bash
# from the repo root — installs both client and server at once (pnpm workspace)
pnpm install
docker compose up -d postgres         # starts a local Postgres on :5432
cp server/.env.example server/.env    # (optional) fill in OPENAI_API_KEY to enable AI

# starts the backend (:3001) and frontend (:5173) together
pnpm dev
```

Open **http://localhost:5173**. The schema is created automatically (migrate-on-boot) and a default profile + sample vacancies are seeded on first run.

Other useful commands from the root: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`,
`pnpm test:coverage`, `pnpm test:e2e` (Playwright, requires `pnpm build`).

### Production mode (single process)

```bash
pnpm build                            # builds the client into client/dist
pnpm --filter jobtrack-server start   # the server serves the frontend itself at http://localhost:3001
```

### Docker (one command)

```bash
docker compose up --build      # app + Postgres available at http://localhost:3001
```

A multi-stage image builds the frontend and runs the API; a `postgres` service runs alongside it, with data persisted in the `jobtrack-pg` Docker volume. LLM keys are passed via environment variables in `docker-compose.yml`.

## AI mode (optional)

Without a key, everything works in **offline mode** (tech-dictionary-based analysis, template letters). To enable AI, fill in `server/.env`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Anthropic is also supported (`LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=...`). If **both** keys are set, `client.ts` automatically tries the other provider if the first one fails outright (outage/rate limit).

`server/src/config/env.ts` validates `.env` with Zod at startup (fail-fast) and checks that a key exists specifically for the chosen `LLM_PROVIDER` (not just any key) — otherwise it logs a warning instead of silently running AI in a "half-enabled" state.

### LLM layer technical details

- **Two model tiers** (`tier: "fast" | "smart"`) — a cheap model for extraction/formatting, a stronger one for deep analysis (CV review, matching, cover letters, generation).
- **`chatJson<T>()`** (`server/src/llm/client.ts`) — `chat()` in JSON mode plus Zod schema validation and one self-repair retry if the response fails validation. Each call site only has to declare the expected shape.
- Caching keyed by input hash, one retry on transient errors (`429`/`5xx`), tier-aware timeouts, logging of provider errors and truncated JSON responses, token accounting (`normalizeUsage()`).

### Algorithmic improvements (non-LLM, deterministic)

Faster/cheaper than an LLM wherever the task doesn't require "understanding" text — all of these are tested offline:

- **FSRS** (`study/fsrs.ts`) — the spaced-repetition algorithm behind SRS flashcards (the same one Anki uses).
- **TF-IDF** (`jobs/job-ranking.ts`) — ranking of external job listings in `/jobs/search`.
- **Fuzzy matching / Levenshtein** (`shared/fuzzy-match.ts`) — tolerance for typos in technology names.
- **Probabilistic fit score** (`vacancies/vacancy-text.ts`) — a logistic function instead of a crude "5 matches = high."
- **Recency-weighted demand** (`shared/demand.ts`) — exponential decay of a job posting's weight by age (90-day half-life).
- **SimHash deduplication** (`jobs/job-dedupe.ts`) — merging near-duplicate postings from different aggregators (`/jobs/search`, import), and flagging (never blocking) a likely duplicate when you add a vacancy by hand or paste a URL.
- **Vector embeddings** (`llm/embeddings.ts`) — OpenAI `text-embedding-3-small` for semantic CV↔job similarity (OpenAI key only).
- **Funnel conversion and average time in status** (`db/vacancy-history.ts`) — derived metrics from the status-change history log.

### Semantic vacancy similarity (pgvector)

Every vacancy gets its embedding computed and stored automatically (best-effort, fire-and-forget — never adds latency to saving a vacancy) whenever its content changes, from a short synthesized "position at company. Level: X. Stack: ..." blob (`vacancies/vacancy-text.ts#vacancyEmbeddingText`). `GET /api/vacancies/:id/similar` returns the most semantically similar OTHER vacancies you've tracked, ranked by cosine distance via Postgres' [pgvector](https://github.com/pgvector/pgvector) extension and an HNSW index (`vacancies.repo.ts#findSimilarVacancies`) — an actual approximate-nearest-neighbor search, not a full-table brute-force scan. Surfaced in the UI as a small "🔗" toggle on each vacancy row/card (`features/vacancies/similar-vacancies-button.tsx`), fetched lazily — only once a user actually opens it, not eagerly for every row.

- **Requires the `pgvector/pgvector:pg16` Postgres image** (already the default in `docker-compose.yml`) instead of plain `postgres:16-alpine` — a bare Postgres image can't `CREATE EXTENSION vector` (the `.control`/`.so` files aren't present). If you're running Postgres yourself outside Docker, install the [pgvector extension](https://github.com/pgvector/pgvector#installation) on it first.
- **Vacancies added before this feature shipped** have no embedding yet — run `npx tsx server/scripts/backfill-vacancy-embeddings.ts` (add `--dry-run` to preview first) once to fill them in.
- Offline (no OpenAI key) — `/vacancies/:id/similar` returns an empty list rather than an error, the same "degrade gracefully" convention as every other optional AI feature here.
- Tests run against PGlite (`db/test-db.ts`) with the `@electric-sql/pglite-pgvector` extension loaded, so the exact same migration (`drizzle/0005_stormy_shocker.sql`, including `CREATE EXTENSION vector` and the HNSW index) is exercised in CI as in production, not a hand-approximated schema.

## Internationalization (i18n)

Full English/Ukrainian localization — switching language changes every page and toast **and** the
language of AI-generated prose (interview feedback, CV review, focus-of-the-week) and the static
study/knowledge-base/resources content, not just the UI chrome.

- **Client** — `react-i18next`, with translations split one JSON file pair per feature namespace
  (`client/src/i18n/locales/{en,uk}/<namespace>.json`) instead of one giant file. This is what
  makes translation keys type-safe (a typo or a key missing in one locale is a `tsc` error, see
  `client/src/i18n/i18next.d.ts`) and lets each page's translations be added independently of the
  others.
- **Persisted values stay in English.** A vacancy's `VacancyStatus`/`Fit`, or a roadmap skill's
  `RoadmapStatus`, are never translated in place — they're stored in Postgres and matched by name
  elsewhere in the code. Only the *displayed label* is translated (`shared/status-labels.ts`,
  `shared/fit-tone.ts`), so switching language never touches the underlying data.
- **Server** — the client sends the active language as an `X-Locale` header on every request
  (including better-auth's own routes, so verification/reset-password/delete-account emails are
  localized too); `core/request-context.ts`'s `getLocale()` reads it back out request-scoped, via
  `AsyncLocalStorage`. LLM calls opt in per call site (`chat()`'s `outputLocale: "app"`) — only
  for prose the UI language should own; a CV review written for a US recruiter, a cover letter, or
  a LinkedIn optimizer suggestion still follows the *document's* own language, not the UI's, and
  skill extraction stays English-only since its output is matched against vacancy tech names.
- **Static content** (flashcards, drills, the knowledge base, pet projects, resources) is
  pre-translated once and checked in as data — an English source file plus a `<name>.uk.ts`
  sibling, picked by `getLocale()` at request time (see `study/content.ts`'s `getCards`/
  `getDrills`) — not machine-translated live on every request.

## Logging

Structured JSON logging via `pino` (colorized output through `pino-pretty` in dev, clean JSON to stdout in production).

- `pino-http` logs every HTTP request with a unique `reqId`; `AsyncLocalStorage` threads it through to services without needing direct access to `req`.
- A global `redact` rule — `Authorization`/`Cookie`/`password`/`apiKey` never end up in the logs.
- `unhandledRejection`/`uncaughtException` are logged in a structured way instead of getting lost in stderr.

For aggregating logs in production (JSON to stdout, compatible with any collector),
**[Axiom](https://axiom.co/)** or **[Better Stack Logs](https://betterstack.com/logs)** work well (both have a ready-made pino transport and a generous free tier), or a self-hosted **[Dozzle](https://dozzle.dev/)** on top of `docker logs` for personal use. Wiring one in is configuration, not code — pino already emits clean JSON to stdout; point the chosen collector at the container's log stream (or add its pino transport to `core/logger.ts` if you'd rather ship logs directly from the process).

## Production readiness

- **Rate limiting** (`core/rate-limit.ts`) keeps its counters in the process's own memory by default — correct for a single instance. Set `REDIS_URL` (see `server/.env.example`, and the commented-out `redis` service in `docker-compose.yml`) once you run more than one replica behind a load balancer, or each replica stops sharing counters with the others.
- **Backups.** A managed Postgres (e.g. Railway) gives you automatic backups, but a backup nobody has ever restored isn't really a backup — actually run a restore against a scratch database at least once, on whatever schedule you're comfortable with. Two complementary options that don't depend on your host's backup tooling:
  - `pg_dump $DATABASE_URL > backup.sql` for a full, off-site, host-independent copy.
  - **Per-user export** — `GET /api/account/export` (also exposed as an "Export my data" button on the Account page) returns one user's own profile/vacancies/companies/progress as JSON. Useful for a single person's data, not a substitute for a real database backup.
- **Account deletion.** Self-service, via the Account page — email-confirmation flow (better-auth's `user.deleteUser`, see `auth/auth.ts`), a hard delete of the `user` row that cascades to every one of their tables (`ON DELETE CASCADE`, see `db/schema/*.ts`).

## CI and code quality

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

1. **Lint · Typecheck · Test · Build** — for client and server, with baseline test-coverage thresholds.
2. **E2E (Playwright)** — key end-to-end flows against the production build (registers + logs in a real test user first, see `e2e/auth.setup.ts`), LLM in offline mode (deterministic, no paid APIs), run sequentially (`workers: 1`). Locally, `pnpm test:e2e` points at a separate `jobtrack_e2e` database on the same Postgres instance (not the one `pnpm dev` uses) — create it once with `createdb jobtrack_e2e` (or any Postgres client) if it doesn't exist yet; `pretest:e2e` drops every table in it before each run.

Locally, `husky` + `lint-staged` automatically run Prettier before every commit.
Dependabot (`.github/dependabot.yml`) proposes npm/Docker/Actions updates weekly.

## Security

- `helmet()` with a real Content-Security-Policy, a global rate limit on `/api` (600 requests/15 min per IP), a separate, stricter limit for AI endpoints (30/15 min per **account** — falling back to IP only when unauthenticated — they cost real money in LLM usage, and per-IP alone would let one heavy account throttle everyone sharing its office/VPN address).
- Timeouts on all LLM provider calls, SSRF protection for parsing job postings by URL (blocks localhost/private/link-local IPs, including cloud metadata addresses), file-type restrictions on uploads (`multer`).
- `CORS_ORIGIN`/`TRUST_PROXY` are explicitly disabled by default, enabled only when actually needed.
- The JS sandbox for drill practice (`study/runner.ts`) runs in an isolated Web Worker with a hard timeout — not on the main thread.
- The Docker image runs the process as an unprivileged user.

**Authentication (better-auth).** Email+password (with required email verification) and Google OAuth. Every table is scoped by `user_id` (a real FK to the `user` table, `ON DELETE CASCADE`) — see "Multi-tenancy migration" below for what's still open. Without `RESEND_API_KEY` configured, verification/reset-password emails are logged instead of sent (see `server/.env.example`), so local dev needs no email provider to exercise the full flow.

## Architecture

The backend is structured **around domain modules** (feature-based, layered style without framework overhead): each module has a thin `*.routes.ts` (parse → delegate → respond) and a `*.service.ts`/`*.data.ts` with the business logic, which can be unit-tested without Express.

```
jobtrack/
├── Dockerfile, docker-compose.yml   # containerization (multi-stage)
├── landing.html             # standalone marketing page (no build step, not part of the Vite app —
│                             # meant to be hosted separately, e.g. as a static landing page)
├── server/                  # Node (ESM) + TypeScript + Express + Postgres/Drizzle
│   └── src/
│       ├── index.ts         # entrypoint: bootstraps the default user, then app.listen()
│       ├── app.ts           # assembles the Express app (middleware → /api → static → errorHandler)
│       ├── routes.ts        # aggregates all modules/*/*.routes.ts into a single Router
│       ├── config/env.ts    # single typed access point for process.env
│       ├── core/            # http (HttpError/asyncHandler, authed()/requireAdmin()), logger, error-handler
│       ├── auth/             # better-auth instance (email+password, Google OAuth, admin plugin), email sending
│       ├── db/               # Postgres client (migrate-on-boot), schema/ (Drizzle), kv, bootstrap, llm-cache
│       ├── llm/              # OpenAI/Anthropic client with graceful fallback + response cache + cost estimation (pricing.ts)
│       ├── telemetry/        # fire-and-forget llm_usage/product_events inserts (see admin module)
│       ├── shared/           # tech-dict, skill-extraction, validation (DTO+SSRF), demand, hash, slug, upload, locale.ts
│       └── modules/         # one folder per API domain:
│           ├── vacancies/   # job CRUD + job-text analysis
│           ├── jobs/        # search across external aggregators (DOU/Remotive/Arbeitnow)
│           ├── cv/          # profile, CV builder (multi-profile), review/match, LinkedIn import, upload
│           ├── cv-shares/   # public, no-session CV links (random slug), one per CV profile
│           ├── knowledge/   # static + LLM-personalized knowledge base
│           ├── roadmap/     # roadmap.sh-style skill map built from real data + skill radar
│           ├── plan21/      # dynamic 21-day intensive (gaps: job postings − CV)
│           ├── study/       # SRS cards + drills (static + LLM-generated, per-track content)
│           ├── design/      # design-trainer exercises, AI grading, "defense" follow-ups
│           ├── mock/        # mock interview questions/tasks, voice mode (speech-to-text/TTS)
│           ├── admin/       # users/activity, LLM cost, product analytics — behind requireAdmin()
│           ├── account/     # self-service data export (better-auth's deleteUser handles deletion, no route of our own)
│           ├── billing/     # Stripe subscriptions, free/paid AI-quota entitlements
│           ├── calendar/    # unified interview/deadline calendar (manual events + vacancy next-steps)
│           ├── contacts/    # networking tracker (recruiter/interviewer contacts, linked to companies/vacancies)
│           ├── saved-searches/  # job-alert digests for a saved query/region
│           ├── digest/      # weekly email digest scheduler
│           ├── telegram/    # optional Telegram-bot linking, alternate notification channel
│           ├── onboarding/  # first-run welcome/setup state
│           └── projects/, resources/, companies/, analytics/, writing/, health/
└── client/                  # React + Vite + TS + Router + TanStack Query
    └── src/
        ├── main.tsx, index.css      # entrypoint
        ├── app/App.tsx              # routing (React Router), sidebar/shell, providers
        ├── i18n/                    # react-i18next bootstrap; locales/{en,uk}/<namespace>.json; type-safe keys (i18next.d.ts)
        ├── shared/                  # cross-cutting things shared by all features:
        │   ├── api.ts               # single typed contract with the backend
        │   ├── queries/             # TanStack Query hooks per domain (cache, invalidation, optimistic mutations)
        │   ├── toast.tsx            # ToastProvider/useToast
        │   ├── ui-state.ts          # useUi — persistent UI state for tabs
        │   ├── language-switcher.tsx, status-labels.ts, fit-tone.ts  # EN/UK toggle; wire-value → translated label
        │   ├── types.ts             # shared DTO types (mirror the backend)
        │   └── ui.tsx               # UI kit (Btn, Card, Chip, PageHeader, Skeleton…)
        └── features/                # one folder per screen domain (mirrors server/src/modules):
            ├── dashboard/, vacancies/, jobs/, analyzer/, companies/
            ├── cv/                  # CV view + CV Builder (cv.tsx, cv-builder/*, multi-profile tab strip)
            ├── calendar/            # unified interview/deadline calendar + reminder notifications
            ├── contacts/            # networking tracker
            ├── knowledge/           # study plan (learn.tsx)
            ├── roadmap/, plan21/, projects/, resources/
            ├── design/              # design-trainer canvas, grading, defense mode, history
            ├── mock/                # mock interviews incl. voice mode (speech.ts, voice-interview.tsx)
            ├── study/               # SRS + drills (study.tsx) + JS sandbox (runner.ts)
            ├── analytics/           # Skill radar + charts (charts.tsx, code-split)
            ├── admin/               # users/activity, LLM cost, product analytics — nav item + route gated on session.user.role
            ├── billing/             # pricing/plan page (Stripe checkout)
            ├── legal/               # Terms of Service / Privacy Policy pages
            ├── welcome/             # first-run onboarding
            └── account/             # export my data + delete my account
```

Data and mutations flow through **TanStack Query** (`shared/queries/*`) — each domain has its own hook with a typed cache key; toggle mutations do an optimistic update with rollback on network error. There's no global "god context" — pages subscribe only to the data they actually need.

## What's next (ideas for future work)

See "Multi-user SaaS readiness" below for what's specifically missing to run this as a real
multi-user product rather than a single-deployment personal tool.

### Multi-tenancy

The data layer runs on Postgres/Drizzle, every table/repository function is scoped by an explicit `userId` parameter (see `db/schema/`, `db/user-id.ts`, `core/http.ts#authed`), and real auth (better-auth) provides that `userId` from a session. The LLM/embeddings/skill-extraction response caches (`db/llm-cache.ts`) stay deliberately global — safe because they're keyed on a SHA-256 hash of the full input text (`shared/hash.ts`), not a per-user attribute — and `security/cross-tenant-isolation.test.ts` exercises two real registered users end-to-end over real HTTP to prove no cross-tenant leak, including admin-only routes (a logged-in non-admin gets 403, not 200).

**Admin accounts.** There's no signup checkbox or env-var toggle for this — grant it directly, after the person has registered: `node server/scripts/make-admin.mjs <email>`. Deliberately not automatic (e.g. an `ADMIN_EMAIL` env var matched on login) — that would be a standing, always-on privilege-escalation path reachable from the normal login flow, instead of an explicit, out-of-band action. Once granted, the "Admin" nav item and `/admin` page (users/activity, LLM cost, product analytics, and a link to your external error tracker via the optional `LOGS_DASHBOARD_URL`) show up automatically — nothing else to configure.

**Legacy personal data.** If you have real data in an old `server/jobtrack.db` (from before this migration), migrate it with `node server/scripts/migrate-sqlite-data.mjs --dry-run` (preview), then without the flag to actually write it into Postgres under the `bootstrap-user` id. Run it **before** starting the app against a fresh Postgres — otherwise the startup bootstrap step seeds sample data first and the migration script's own duplicate-guard refuses to run without `--force`. Once you've registered a real account, claim that data with `node server/scripts/claim-bootstrap-data.mjs <email>` — it reassigns everything from `bootstrap-user` onto your real account (replacing the fresh default profile registration seeded for you, since the bootstrap data is the real one).

**CV Builder multi-profile backfill.** Accounts that saved a CV before the multiple-CV-profiles
feature shipped have it seeded into their first profile automatically (a `cv_profiles` row is
created lazily the first time `GET /cv/profiles` runs for that account) — no manual step needed
for a normal deployment. `node server/scripts/migrate-cv-profiles.ts --dry-run` (then without the
flag) exists only for the one-time bulk backfill at deploy time and to re-link any pre-existing
public CV share row (from the old one-share-per-account era) to that new profile; see the script's
own header comment for why this couldn't be folded into the `drizzle-kit`-generated schema
migration itself.

## Multi-user SaaS readiness

This app is architecturally multi-tenant already (see "Multi-tenancy" above) — every table is
scoped by `userId`, real auth backs every session, and the cross-tenant isolation test proves it
end-to-end. What's below is what's *specifically* still missing to run this confidently as a
product with strangers signing up, rather than a single-deployment personal tool. Already
addressed as part of this pass:

- **Admin can now suspend an abusive/runaway account.** `POST /admin/users/:userId/ban` and
  `.../unban` (better-auth's admin plugin), with a "Ban"/"Unban" button next to the existing
  `banned` badge on the admin Users tab — previously the badge existed but nothing could set it
  from the UI.
- **The AI rate limiter is now keyed per-account, not per-IP.** `aiLimiter`
  (`server/src/core/rate-limit.ts`) resolves the caller's session and buckets by `userId`, falling
  back to IP only for unauthenticated requests — previously every user behind the same office/VPN
  IP shared one throttling bucket. The general `apiLimiter` deliberately stays IP-keyed (it's
  mounted on every request; per-account keying there would cost a second session lookup on every
  single API call for a limiter whose job is just a coarse anti-runaway-loop backstop).

Already addressed, continued:

- **Per-account LLM daily spend cap.** `LLM_DAILY_COST_CAP_USD` (`server/.env.example`, default
  `0`/disabled) — `llm/client.ts` checks the caller's spend for the current UTC day
  (`telemetry/telemetry.repo.ts#getUserCostUsdSince`) before every provider call on a cache miss,
  and soft-blocks (returns `null`, the caller degrades to its offline fallback exactly like a
  self-hoster with no key) once the cap is hit. Fails open if the telemetry read itself errors, so
  a DB hiccup never takes AI features down. Recorded as `llm_usage.outcome = "budget_exceeded"`.
- **A Chrome extension exists** (`extension/` — "Zorya Job Clipper", MV3) that captures a job
  posting from any page (JSON-LD `JobPosting` parsing with a text-heuristic fallback) and saves it
  via the same session cookie the web app uses. It's dev-only as committed (`host_permissions`
  hardcoded to `localhost:3001`, no build step, not part of the pnpm workspace) — productionizing
  it (configurable API origin, form autofill) is tracked below.
- **Billing/subscriptions.** Stripe integration (`modules/billing/`) — a free tier with a
  per-calendar-month AI-call quota (`BILLING_FREE_AI_CALLS_PER_MONTH`) and a paid tier with a
  fair-use monthly cost ceiling (`BILLING_PRO_MONTHLY_COST_CEILING_USD`), checkout + webhook
  handling, and a pricing page (`features/billing/pricing.tsx`). Inert until
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_PRO_MONTHLY` are set
  (`server/.env.example`) — every account is unlimited/free without them, same
  "optional, degrades gracefully" convention as the LLM keys.
- **Terms of Service / Privacy Policy.** Static pages (`features/legal/{terms,privacy}.tsx`),
  linked from the auth/legal footer. Covers the *published-policy* half of GDPR-style compliance;
  account data export and self-service deletion (`account/` module, better-auth's `deleteUser`)
  already covered the technical portability/deletion half.

Still open, roughly in priority order for an actual multi-user launch:

1. **`budget_exceeded`/`quota_exceeded` visibility in the admin panel.** The data is recorded in
   `llm_usage.outcome`, but no admin query currently selects, filters, or groups by it — an
   account hitting its cap is invisible to an admin today.
2. **In-memory rate-limit store across multiple instances** (already flagged in "Production
   readiness" above) — set `REDIS_URL` before running more than one replica, or the effective
   limit becomes N× the declared one.
3. **No cookie/consent banner** and no documented data-retention policy beyond the ToS/Privacy
   pages themselves — worth adding once cookies/analytics beyond the app's own session cookie are
   in play.
4. **Abuse monitoring beyond a manual ban.** The admin panel is otherwise read-only analytics —
   there's no automated flag for a suspicious pattern (e.g. one account spiking `llm_usage`, or
   registering many accounts from one IP) short of an admin noticing it themselves in the Users
   tab.
5. **Email deliverability at scale.** `RESEND_API_KEY` (or the "log instead of send" offline
   fallback) is fine for a single deployment's verification/reset emails; a real multi-user
   signup flow eventually needs to think about sender reputation/bounce handling at volume, which
   a single API key + default sending domain doesn't address on its own.
6. **Onboarding for a stranger, not just a returning solo user.** There's now a first-run welcome
   flow (`features/welcome/`), but it's never been evaluated against a cold-signup conversion
   funnel — worth a look once real external users are the goal, not before.

None of the above is urgent for the current single-deployment personal-tool use case this README
otherwise documents — they're the concrete list for *if/when* that changes.
