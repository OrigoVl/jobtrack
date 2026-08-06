// The single better-auth instance — this is where the phase-2 bootstrap constant
// (server/src/db/user-id.ts) finally gets replaced by a real, session-backed user id. Nothing
// downstream (repositories, services, routes) changes: `authed()` (core/http.ts) is the only
// place that reads a session, and every repository already takes `userId` as an explicit
// parameter regardless of where it came from.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import db from "../db/client.js";
import * as schema from "../db/schema/index.js";
import { env } from "../config/env.js";
import { sendEmail } from "../shared/email.js";
import { seedProfileIfEmpty } from "../db/bootstrap.js";
import { cancelSubscriptionForAccountDeletion } from "../modules/billing/billing.service.js";
import type { UserId } from "../db/user-id.js";
import { getLocale } from "../core/request-context.js";
import type { AppLocale } from "../shared/locale.js";

// One template per email kind, keyed by locale — mirrors llm/client.ts's LANGUAGE_NAME lookup
// (same "small Record instead of a template engine/i18n library" style). These callbacks run
// inside the same Express request that populated core/request-context.ts's locale (from the
// client's X-Locale header, see app.ts's middleware), so `getLocale()` below picks the right one
// without threading a locale parameter through better-auth's own callback signature.
interface EmailTemplate {
  subject: string;
  html: (url: string) => string;
}

const RESET_PASSWORD_EMAIL: Record<AppLocale, EmailTemplate> = {
  en: {
    subject: "Reset your Zorya password",
    html: (url) =>
      `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>` +
      `<p>If you didn't request this, you can ignore this email.</p>`,
  },
  uk: {
    subject: "Скиньте пароль Zorya",
    html: (url) =>
      `<p>Перейдіть за посиланням нижче, щоб скинути пароль:</p><p><a href="${url}">${url}</a></p>` +
      `<p>Якщо ви не робили цей запит, просто проігноруйте цей лист.</p>`,
  },
};

const VERIFY_EMAIL: Record<AppLocale, EmailTemplate> = {
  en: {
    subject: "Verify your Zorya email",
    html: (url) => `<p>Click the link below to verify your email and finish creating your account:</p><p><a href="${url}">${url}</a></p>`,
  },
  uk: {
    subject: "Підтвердьте свою пошту в Zorya",
    html: (url) =>
      `<p>Перейдіть за посиланням нижче, щоб підтвердити пошту і завершити створення акаунта:</p><p><a href="${url}">${url}</a></p>`,
  },
};

const DELETE_ACCOUNT_EMAIL: Record<AppLocale, EmailTemplate> = {
  en: {
    subject: "Confirm deleting your Zorya account",
    html: (url) =>
      `<p>Click the link below to permanently delete your account and all of its data (vacancies, CV, progress). This cannot be undone.</p>` +
      `<p><a href="${url}">${url}</a></p>` +
      `<p>If you didn't request this, ignore this email — your account is safe.</p>`,
  },
  uk: {
    subject: "Підтвердьте видалення акаунта Zorya",
    html: (url) =>
      `<p>Перейдіть за посиланням нижче, щоб остаточно видалити свій акаунт і всі його дані (вакансії, CV, прогрес). Це неможливо скасувати.</p>` +
      `<p><a href="${url}">${url}</a></p>` +
      `<p>Якщо ви не робили цей запит, просто проігноруйте цей лист — ваш акаунт у безпеці.</p>`,
  },
};

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.auth.secret,
  baseURL: env.auth.baseUrl,
  // Without this, better-auth's own built-in rate limiter (auto-enabled in production, protects
  // /api/auth/* — login/register/reset — from brute force) keeps its counters in this process's
  // own memory; with 2+ replicas behind a load balancer the effective limit silently multiplies
  // by replica count. "database" reuses the SAME Postgres connection already configured just
  // above (`database: drizzleAdapter(...)`) so counters are correctly shared — no Redis needed
  // for this one, unlike core/rate-limit.ts's own limiters.
  rateLimit: {
    storage: "database",
  },
  // better-auth rejects any request whose Origin header isn't baseURL or in this list. In dev,
  // the browser's real origin is Vite's dev server (client/vite.config.ts, port 5173) — Vite
  // proxies /api to this server (making requests same-origin from the client's point of view),
  // but does NOT rewrite the Origin header, so the backend still sees "http://localhost:5173",
  // not its own baseURL. Harmless to include unconditionally (also in production): it's just an
  // unreachable local address unless someone's deliberately running the built server on their
  // own machine, which is self-consistent, not a new trust boundary.
  trustedOrigins: [env.auth.baseUrl, "http://localhost:5173", ...(env.corsOrigins ?? [])],

  emailAndPassword: {
    enabled: true,
    // Registering is required before login works — see the CLAUDE.md/README notes on this
    // being a deliberate product decision (not the low-friction "log in immediately" default),
    // so RESEND_API_KEY absence (dev/e2e) falls back to logging the link — see auth/email.ts.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html } = RESET_PASSWORD_EMAIL[getLocale()];
      await sendEmail({ to: user.email, subject, html: html(url) });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html } = VERIFY_EMAIL[getLocale()];
      await sendEmail({ to: user.email, subject, html: html(url) });
    },
  },

  // undefined (not configured) — the client hides the "Continue with Google" button entirely
  // (see GET /api/auth-config, client/src/shared/auth-client.ts) rather than showing a button
  // that would fail.
  socialProviders: env.auth.google ? { google: env.auth.google } : undefined,

  user: {
    // Self-service account deletion (Phase 7) — email-confirmation flow (not immediate
    // password-confirm deletion): this is a hard, irreversible delete of the `user` row, which
    // cascades via ON DELETE CASCADE to every one of their vacancies/companies/user_kv/srs/
    // llm_usage/product_events (see db/schema/*.ts). The extra "click a link in your email"
    // step is the same safety margin this app already gives password resets — appropriate for
    // an action with no undo.
    deleteUser: {
      enabled: true,
      // Runs BEFORE the user row (and its cascaded subscriptions row) is deleted — the last
      // moment a Stripe subscription can still be resolved and canceled. See
      // billing.service.ts#cancelSubscriptionForAccountDeletion for why this never blocks
      // deletion on a Stripe-side failure.
      beforeDelete: async (user) => {
        await cancelSubscriptionForAccountDeletion(user.id as UserId);
      },
      sendDeleteAccountVerification: async ({ user, url }) => {
        const { subject, html } = DELETE_ACCOUNT_EMAIL[getLocale()];
        await sendEmail({ to: user.email, subject, html: html(url) });
      },
    },
  },

  // Bootstrapping the first admin is deliberately NOT done here (e.g. via an ADMIN_EMAIL env
  // var matched on login) — that would be a standing, always-on privilege-escalation code path
  // reachable from the normal login flow. server/scripts/make-admin.mjs flips a specific user's
  // role directly in Postgres instead — an explicit, out-of-band action, not something any
  // request can trigger.
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],

  // Every new account needs at least a default profile row — without one, getProfile() throws
  // and most features 500 on first use. Deliberately does NOT seed sample vacancies here (unlike
  // the BOOTSTRAP_USER_ID startup path) — seeding a real signup with fake demo data is a
  // separate, still-open product decision (see the phase-4 plan notes).
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await seedProfileIfEmpty(user.id as UserId);
        },
      },
    },
  },

  // Auth-endpoint rate limiting (brute-force protection on login/register/reset, keyed by IP)
  // uses better-auth's own built-in limiter — enabled automatically in production (see the
  // `rateLimit` option above for the shared-storage config); this app's own express-rate-limit
  // (core/rate-limit.ts) covers everything else (domain API endpoints, keyed by userId once a
  // session exists).
});
