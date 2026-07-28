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
    OPENAI_MODEL_SMART: z.string().trim().min(1).default("gpt-4o"),
    ANTHROPIC_API_KEY: z.string().trim().min(1).optional(),
    ANTHROPIC_MODEL: z.string().trim().min(1).default("claude-haiku-4-5-20251001"),
    ANTHROPIC_MODEL_SMART: z.string().trim().min(1).default("claude-sonnet-4-5-20250929"),
    // How long to wait for a response from the LLM provider before giving up — so a hung
    // OpenAI/Anthropic response doesn't hold the user's request (and connection) forever.
    // Two-tier timeout: "fast" (extraction/hints) fails faster than "smart" (complex
    // structured generation, which needs more time) — a quicker fallback to the offline
    // heuristic for simple tasks that shouldn't "hang" for long.
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    LLM_TIMEOUT_MS_FAST: z.coerce.number().int().positive().default(15_000),
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

    // better-auth: signs/encrypts session cookies and tokens — required in production
    // (enforced below), with an obviously-insecure dev-only fallback so a fresh local checkout
    // doesn't need any auth setup to run `pnpm dev`.
    BETTER_AUTH_SECRET: z.string().trim().min(1).optional(),
    // The origin the auth handler considers itself to run at (used to build email verification/
    // reset links and OAuth callback URLs) — defaults to http://localhost:PORT in dev.
    BETTER_AUTH_URL: z.string().trim().min(1).optional(),
    // Resend (optional) — not set → verification/reset-password emails are logged instead of
    // sent (the same graceful-offline-fallback pattern as the LLM keys), so local dev/e2e need
    // no email provider at all. EMAIL_FROM defaults to Resend's shared sandbox sender, which
    // only delivers to the Resend account's own verified email until a custom domain is set up.
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    EMAIL_FROM: z.string().trim().min(1).default("JobTrack <onboarding@resend.dev>"),
    // Google OAuth (optional) — both or neither (enforced below); absent → the client hides the
    // "Continue with Google" button and only email+password is offered.
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
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
    migrateOnBoot: raw.DB_MIGRATE_ON_BOOT,
  },

  sentry: {
    dsn: raw.SENTRY_DSN,
    appVersion: raw.APP_VERSION,
    get isAvailable(): boolean {
      return !!env.sentry.dsn;
    },
  },

  auth: {
    // INSECURE dev-only fallback — never used in production (BETTER_AUTH_SECRET is required
    // there, enforced above). Fixed rather than randomly generated per boot so sessions survive
    // a local server restart during development.
    secret: raw.BETTER_AUTH_SECRET || "dev-only-insecure-secret-do-not-use-in-production",
    baseUrl: raw.BETTER_AUTH_URL || `http://localhost:${raw.PORT}`,
    google:
      raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET
        ? { clientId: raw.GOOGLE_CLIENT_ID, clientSecret: raw.GOOGLE_CLIENT_SECRET }
        : undefined,
  },

  email: {
    resendApiKey: raw.RESEND_API_KEY,
    from: raw.EMAIL_FROM,
    get isAvailable(): boolean {
      return !!env.email.resendApiKey;
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
