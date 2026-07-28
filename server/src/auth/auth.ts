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
import { sendEmail } from "./email.js";
import { seedProfileIfEmpty } from "../db/bootstrap.js";
import type { UserId } from "../db/user-id.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.auth.secret,
  baseURL: env.auth.baseUrl,
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
      await sendEmail({
        to: user.email,
        subject: "Reset your JobTrack password",
        html: `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your JobTrack email",
        html: `<p>Click the link below to verify your email and finish creating your account:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },

  // undefined (not configured) — the client hides the "Continue with Google" button entirely
  // (see GET /api/auth-config, client/src/shared/auth-client.ts) rather than showing a button
  // that would fail.
  socialProviders: env.auth.google ? { google: env.auth.google } : undefined,

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
  // uses better-auth's own built-in limiter — enabled automatically in production, no extra
  // config needed; this app's own express-rate-limit (core/rate-limit.ts) covers everything
  // else (domain API endpoints, keyed by userId once a session exists).
});
