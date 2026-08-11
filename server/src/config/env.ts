// The single access point for environment variables. The rest of the code does NOT read
// process.env directly — this simplifies testing and gives one-shot default validation
// plus IDE autocompletion.
import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/config/env.ts -> server/ (package root)
const serverRoot = path.join(__dirname, "..", "..");

const isProduction = process.env.NODE_ENV === "production";

// Vitest sets VITEST=true in every worker it spawns. Read here (and nowhere else — see this
// file's own rule about process.env) so `migrateOnBoot` below can be forced off under unit tests.
const isVitest = process.env.VITEST === "true";

// Validate the "raw" process.env right at startup — better to fail with a clear message
// (e.g. a typo'd LLM_PROVIDER) than silently fall back to a default and break somewhere deep.
const RawEnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    // Postgres connection string (Drizzle). Optional here — required only in production, enforced
    // below via superRefine — so `env.test.ts` and every dev machine that hasn't migrated to
    // Postgres yet don't fail validation just by importing this module. Defaults to the same
    // credentials as the `postgres` service in docker-compose.yml.
    DATABASE_URL: z.string().trim().min(1).optional(),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_MIGRATE_ON_BOOT: z
      .string()
      .trim()
      .default("true")
      .transform((v) => v !== "false"),
    // Comma-separated list of allowed origins (e.g. "https://app.example.com,https://admin.example.com").
    // Not set → CORS is open to all origins (the app has no auth/cookies, it only serves its own /api).
    CORS_ORIGIN: z.string().trim().min(1).optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
    LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
    OPENAI_API_KEY: z.string().trim().min(1).optional(),
    OPENAI_MODEL: z.string().trim().min(1).default("gpt-4o-mini"),
    // Deliberately NOT a reasoning model (gpt-5/o-series), which this defaulted to before and
    // which made the heaviest call site — cv-doc-parse, the resume→structure parse — fail for
    // every user: it spent ~28s thinking on even a short CV (against LLM_TIMEOUT_MS's 30s), and
    // its reasoning tokens come out of the SAME maxTokens budget as the answer (1664 of 2600 on
    // that measurement), so a long resume also had its JSON truncated before it closed. Same
    // parse on gpt-4o: ~5.5s, no reasoning tokens. Set OPENAI_MODEL_SMART explicitly if you want
    // a reasoning model — raise LLM_TIMEOUT_MS and the per-call maxTokens along with it.
    OPENAI_MODEL_SMART: z.string().trim().min(1).default("gpt-4o"),
    ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
    ANTHROPIC_MODEL: z.string().trim().min(1).default("claude-haiku-4-5-20251001"),
    ANTHROPIC_MODEL_SMART: z.string().trim().min(1).default("claude-sonnet-5"),
    // How long to wait for a response from the LLM provider before giving up — so a hung
    // OpenAI/Anthropic response doesn't hold the user's request (and connection) forever.
    // Two-tier timeout: "fast" (extraction/hints) fails faster than "smart" (complex
    // structured generation, which needs more time) — a quicker fallback to the offline
    // heuristic for simple tasks that shouldn't "hang" for long.
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    LLM_TIMEOUT_MS_FAST: z.coerce.number().int().positive().default(15_000),
    // Soft per-user daily spend cap in USD, estimated from llm_usage's costUsd (llm/pricing.ts) —
    // 0 (default) disables it. aiLimiter (core/rate-limit.ts) already caps REQUEST rate, but a
    // user could still stay within that rate while racking up real $ cost on repeated "smart"-tier
    // calls; this bounds the $ instead of the request count. A single global number, deliberately
    // ORTHOGONAL to the per-plan quota below — this is an operator safety valve against
    // catastrophic spend by ANY account (including a paying one), while BILLING_FREE_AI_CALLS_PER_MONTH
    // is a product limit on the Free plan. Layered, not replaced by billing: see llm/client.ts.
    LLM_DAILY_COST_CAP_USD: z.coerce.number().nonnegative().default(0),

    // Stripe (optional) — not set → the entire billing module is inert: no quota enforcement,
    // no plan/pricing UI, aiLimiter stays at its flat default. Same graceful-offline-fallback
    // shape as the LLM/email keys above. All three must be set together (enforced below) since a
    // partial config (e.g. a secret key with no webhook secret) would silently accept payments
    // without ever being able to activate the resulting subscription.
    STRIPE_SECRET_KEY: z.string().trim().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().trim().min(1).optional(),
    // Free-tier quota, in billable AI calls per UTC calendar month — NOT a dollar figure,
    // deliberately: estimateCostUsd() (llm/pricing.ts) returns null for any model outside its
    // hardcoded price table, and is explicitly documented as "not a billing-accurate figure", so
    // enforcing a $ promise on Free would let a model change (or a self-hosted deployment) hand
    // out an effectively unlimited quota. A call count can't be evaded that way.
    BILLING_FREE_AI_CALLS_PER_MONTH: z.coerce.number().int().nonnegative().default(20),
    // Pro-tier fair-use ceiling, in USD/month — NOT the Free quota's mechanism (calls), because
    // this one exists purely to keep a single power-user account from running the per-seat
    // margin negative, not to be a marketing-facing number. Reuses the same $ estimate as
    // LLM_DAILY_COST_CAP_USD, just windowed monthly and scoped to Pro/Team accounts.
    BILLING_PRO_MONTHLY_COST_CEILING_USD: z.coerce.number().nonnegative().default(5),
    // Express "trust proxy" — should only be enabled if the app actually sits behind a
    // reverse proxy/LB (nginx, Cloudflare, etc.), otherwise req.ip and rate-limit would see
    // the proxy's IP instead of the client's. Disabled by default (the app listens directly).
    // Example values: "false" (default), "1" (trust the first hop), "loopback".
    TRUST_PROXY: z.string().trim().default("false"),
    // Sentry (optional) — not set → error tracking is disabled, the app keeps logging only
    // through pino (the same "offline by default" approach as the LLM keys above).
    SENTRY_DSN: z.string().trim().min(1).optional(),
    // Build version for grouping errors in Sentry by release ("release health"). Empty in dev.
    APP_VERSION: z.string().trim().min(1).optional(),
    // Link shown on the admin panel's "Logs & Errors" page (Phase 6) — deliberately NOT a
    // Sentry-specific name: the Phase 5 plan decision was to keep logs/errors in the external
    // tracker (Sentry today, possibly Axiom/Better Stack per Phase 7) rather than a Postgres
    // table, so this is just a configurable link, not a data source the admin API queries.
    LOGS_DASHBOARD_URL: z.string().trim().url().optional(),
    // Not set — rate limiting (core/rate-limit.ts) keeps its counters in the process's own
    // memory, correct for a single instance. Required once the app runs as more than one
    // replica behind a load balancer, or each replica's counters stop being shared (the
    // effective limit becomes N times higher than declared).
    REDIS_URL: z.string().trim().min(1).optional(),
    // Ceiling for the GLOBAL per-IP API limiter (core/rate-limit.ts's apiLimiter, 15-minute
    // window) — a coarse anti-runaway-loop backstop, not the AI-cost limiter (that one is
    // per-account and plan-derived). Configurable because the default is sized for one human
    // using the UI, which is exactly wrong for a whole browser-automation suite hammering the
    // API from a single address: the e2e run (playwright.config.ts) raises it so a long suite
    // isn't silently throttled into failures halfway through.
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),

    // Telegram (optional, both or neither) — not set → account linking is hidden in the UI and
    // the digest/saved-searches schedulers only ever notify by email, same graceful-offline-
    // fallback shape as the LLM/email/Stripe keys above. Get a token from @BotFather; the
    // username (no leading @) is needed client-side to build the t.me deep link.
    TELEGRAM_BOT_TOKEN: z.string().trim().min(1).optional(),
    TELEGRAM_BOT_USERNAME: z.string().trim().min(1).optional(),
    // Optional shared secret passed to Telegram's setWebhook (server/scripts/set-telegram-
    // webhook.mjs) as `secret_token`, echoed back on every real webhook call as the
    // `X-Telegram-Bot-Api-Secret-Token` header (telegram.routes.ts checks it) — without this, the
    // webhook URL itself is the only thing standing between the internet and resolveLinkToken().
    // Optional (not enforced below) for backward compatibility with a deployment that registered
    // its webhook before this existed; set it and re-run the script to close that gap.
    TELEGRAM_WEBHOOK_SECRET: z.string().trim().min(1).optional(),

    // better-auth: signs/encrypts session cookies and tokens — required in production
    // (enforced below), with an obviously-insecure dev-only fallback so a fresh local checkout
    // doesn't need any auth setup to run `pnpm dev`.
    BETTER_AUTH_SECRET: z.string().trim().min(1).optional(),
    // The origin the auth handler considers itself to run at (used to build email verification/
    // reset links and OAuth callback URLs) — defaults to http://localhost:PORT in dev.
    BETTER_AUTH_URL: z.string().trim().min(1).optional(),
    // better-auth's own per-IP rate limit (requests per its default 10-second window), separate
    // from API_RATE_LIMIT_MAX above because better-auth handles /api/auth/* itself. Its default
    // (100) is off in development and on in production — which is what the e2e run builds as, so
    // the whole suite's sign-ups and session checks share one bucket from one address and start
    // getting 429s late in the run. Raised there (playwright.config.ts), untouched anywhere else.
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    // The credential endpoints (sign-in/sign-up/change-password/change-email) get their own,
    // much tighter bucket inside better-auth — its built-in rule is 3 per 10s per IP and it
    // deliberately IGNORES AUTH_RATE_LIMIT_MAX above, so raising that alone can't reach it. The
    // default here restates better-auth's own number (production behaviour is unchanged by this
    // being configurable); it exists so the e2e run — one IP registering several throwaway
    // accounts back to back — can raise it the same way it raises the other two limits.
    AUTH_CREDENTIAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
    // Resend (optional) — not set → verification/reset-password emails are logged instead of
    // sent (the same graceful-offline-fallback pattern as the LLM keys), so local dev/e2e need
    // no email provider at all. EMAIL_FROM defaults to Resend's shared sandbox sender, which
    // only delivers to the Resend account's own verified email until a custom domain is set up.
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    EMAIL_FROM: z.string().trim().min(1).default("Zorya <onboarding@resend.dev>"),
    // Google OAuth (optional) — both or neither (enforced below); absent → the client hides the
    // "Continue with Google" button and only email+password is offered.
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
    // LinkedIn OAuth (optional) — both or neither (enforced below); absent → the client hides the
    // "Continue with LinkedIn" button and only email+password/Google (if configured) is offered.
    LINKEDIN_CLIENT_ID: z.string().trim().min(1).optional(),
    LINKEDIN_CLIENT_SECRET: z.string().trim().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production" && !v.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "DATABASE_URL is required in production" });
    }
    if (v.NODE_ENV === "production" && !v.BETTER_AUTH_SECRET) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "BETTER_AUTH_SECRET is required in production" });
    }
    if (!!v.GOOGLE_CLIENT_ID !== !!v.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set, or both left unset",
      });
    }
    if (!!v.LINKEDIN_CLIENT_ID !== !!v.LINKEDIN_CLIENT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["LINKEDIN_CLIENT_ID"],
        message: "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must both be set, or both left unset",
      });
    }
    if (!!v.TELEGRAM_BOT_TOKEN !== !!v.TELEGRAM_BOT_USERNAME) {
      ctx.addIssue({
        code: "custom",
        path: ["TELEGRAM_BOT_TOKEN"],
        message: "TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME must both be set, or both left unset",
      });
    }
    const stripeVars = [v.STRIPE_SECRET_KEY, v.STRIPE_WEBHOOK_SECRET, v.STRIPE_PRICE_PRO_MONTHLY];
    if (new Set(stripeVars.map((x) => !!x)).size > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["STRIPE_SECRET_KEY"],
        message: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_PRO_MONTHLY must all be set, or all left unset",
      });
    }
  });

const parsedEnv = RawEnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
  // eslint-disable-next-line no-console -- the logger isn't ready yet at this stage of app startup
  console.error(`❌ Invalid environment variables (check server/.env):\n${issues}`);
  process.exit(1);
}
const raw = parsedEnv.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  port: raw.PORT,
  // undefined → cors() with no restrictions (allows any origin); array → only the listed ones.
  corsOrigins: raw.CORS_ORIGIN
    ? raw.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : undefined,
  logLevel: raw.LOG_LEVEL || (isProduction ? "info" : "debug"),
  clientDistPath: path.join(serverRoot, "..", "client", "dist"),
  // Express accepts boolean | number | string for "trust proxy" — coerce from the env string.
  trustProxy: (raw.TRUST_PROXY === "true"
    ? true
    : raw.TRUST_PROXY === "false"
      ? false
      : /^\d+$/.test(raw.TRUST_PROXY)
        ? Number(raw.TRUST_PROXY)
        : raw.TRUST_PROXY) as boolean | number | string,

  db: {
    // Falls back to the docker-compose `postgres` service's own credentials in dev — matches
    // `server/drizzle.config.ts`'s default so `drizzle-kit generate` and the running app agree
    // on where the database is without extra .env setup for local development.
    url: raw.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack",
    poolMax: raw.DB_POOL_MAX,
    // Never migrate-on-boot under Vitest. db/client.ts runs `await migrate(...)` at module top
    // level, so ANY unit test that transitively imports it — and plenty do, via shared/demand.ts
    // or a repo module, without ever touching the database themselves — opened a real connection
    // to Postgres just by being imported. That passes locally (docker-compose is up) and fails in
    // CI's unit job, which has no Postgres service: eight pure-logic suites died on
    // `CREATE SCHEMA IF NOT EXISTS "drizzle"` / ECONNREFUSED before running a single assertion.
    //
    // The suites that DO need a database don't need this either: they run against PGlite through
    // db/test-db.ts's createTestDb() and `vi.doMock` db/client.js away entirely (see CLAUDE.md's
    // testing notes). Same spirit as core/http.ts importing auth/auth.js lazily — a unit test
    // should never pay for infrastructure it doesn't use.
    migrateOnBoot: raw.DB_MIGRATE_ON_BOOT && !isVitest,
  },

  sentry: {
    dsn: raw.SENTRY_DSN,
    appVersion: raw.APP_VERSION,
    get isAvailable(): boolean {
      return !!env.sentry.dsn;
    },
  },

  logsDashboardUrl: raw.LOGS_DASHBOARD_URL ?? null,
  redisUrl: raw.REDIS_URL,
  apiRateLimitMax: raw.API_RATE_LIMIT_MAX,

  telegram: {
    botToken: raw.TELEGRAM_BOT_TOKEN,
    botUsername: raw.TELEGRAM_BOT_USERNAME,
    webhookSecret: raw.TELEGRAM_WEBHOOK_SECRET ?? null,
    get isAvailable(): boolean {
      return !!env.telegram.botToken && !!env.telegram.botUsername;
    },
  },

  auth: {
    // INSECURE dev-only fallback — never used in production (BETTER_AUTH_SECRET is required
    // there, enforced above). Fixed rather than randomly generated per boot so sessions survive
    // a local server restart during development.
    secret: raw.BETTER_AUTH_SECRET || "dev-only-insecure-secret-do-not-use-in-production",
    rateLimitMax: raw.AUTH_RATE_LIMIT_MAX,
    credentialRateLimitMax: raw.AUTH_CREDENTIAL_RATE_LIMIT_MAX,
    baseUrl: raw.BETTER_AUTH_URL || `http://localhost:${raw.PORT}`,
    google:
      raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET
        ? { clientId: raw.GOOGLE_CLIENT_ID, clientSecret: raw.GOOGLE_CLIENT_SECRET }
        : undefined,
    linkedin:
      raw.LINKEDIN_CLIENT_ID && raw.LINKEDIN_CLIENT_SECRET
        ? { clientId: raw.LINKEDIN_CLIENT_ID, clientSecret: raw.LINKEDIN_CLIENT_SECRET }
        : undefined,
  },

  email: {
    resendApiKey: raw.RESEND_API_KEY,
    from: raw.EMAIL_FROM,
    get isAvailable(): boolean {
      return !!env.email.resendApiKey;
    },
  },

  billing: {
    stripeSecretKey: raw.STRIPE_SECRET_KEY,
    stripeWebhookSecret: raw.STRIPE_WEBHOOK_SECRET,
    pricePro: raw.STRIPE_PRICE_PRO_MONTHLY,
    freeAiCallsPerMonth: raw.BILLING_FREE_AI_CALLS_PER_MONTH,
    proMonthlyCostCeilingUsd: raw.BILLING_PRO_MONTHLY_COST_CEILING_USD,
    // Gates the ENTIRE billing module — every dev machine, all of e2e, and every self-hoster
    // leave these three unset, so this is false there and the module adds zero DB reads/UI to
    // the existing app. See llm/client.ts's quota check and core/rate-limit.ts's per-plan limit.
    get isAvailable(): boolean {
      return !!env.billing.stripeSecretKey && !!env.billing.stripeWebhookSecret && !!env.billing.pricePro;
    },
  },

  llm: {
    provider: raw.LLM_PROVIDER,
    openaiApiKey: raw.OPENAI_API_KEY,
    openaiModel: raw.OPENAI_MODEL,
    openaiModelSmart: raw.OPENAI_MODEL_SMART,
    anthropicApiKey: raw.ANTHROPIC_API_KEY,
    anthropicModel: raw.ANTHROPIC_MODEL,
    anthropicModelSmart: raw.ANTHROPIC_MODEL_SMART,
    timeoutMs: raw.LLM_TIMEOUT_MS,
    timeoutMsFast: raw.LLM_TIMEOUT_MS_FAST,
    dailyCostCapUsd: raw.LLM_DAILY_COST_CAP_USD,
    // Deliberately tied to the SPECIFIC selected `provider`, not "is ANY key present" —
    // otherwise LLM_PROVIDER=openai (default) with only ANTHROPIC_API_KEY set in .env
    // (a common mistake: the user set a key but forgot to switch the provider) would make
    // isAvailable true, while llm/client.ts would still go down the OpenAI branch with
    // `Bearer undefined` — EVERY request would silently fail with a confusing 401 error in
    // the logs, even though the UI showed "AI: enabled". Now in that case isAvailable is
    // correctly false — the app falls back to offline mode just as cleanly as with no key at
    // all (instead of "half-enabled and always broken"), and the warning below explains why.
    get isAvailable(): boolean {
      return env.llm.provider === "anthropic" ? !!env.llm.anthropicApiKey : !!env.llm.openaiApiKey;
    },
  },
} as const;

// The most common LLM configuration mistake: a key is set for the NOT-selected provider,
// but not for the selected one (e.g. LLM_PROVIDER was left at the default "openai", but only
// ANTHROPIC_API_KEY was set). The key itself does exist on disk — so it's easy to miss, at a
// quick glance at .env, why AI still doesn't work. One warning at startup instead of a silent
// "just offline".
if (!env.llm.isAvailable) {
  const wrongKeySet = env.llm.provider === "anthropic" ? env.llm.openaiApiKey : env.llm.anthropicApiKey;
  if (wrongKeySet) {
    const missing = env.llm.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    const other = env.llm.provider === "anthropic" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    // eslint-disable-next-line no-console -- the logger (core/logger.ts) itself depends on env.ts (import order), not available yet here
    console.warn(
      `⚠️  LLM_PROVIDER=${env.llm.provider}, but ${missing} is not set (only ${other} is present) — AI features will run in offline mode. ` +
        `Set ${missing} or change LLM_PROVIDER in server/.env.`,
    );
  }
}
