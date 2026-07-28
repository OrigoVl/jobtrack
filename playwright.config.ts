import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * E2E config: spins up a production server build (build + node dist/index.js), which
 * itself serves the built frontend (client/dist) — we test the real build, not the dev
 * mode with a separate Vite proxy. Needs a real reachable Postgres at DATABASE_URL — locally
 * that's `docker compose up -d postgres` (see docker-compose.yml); CI runs one as a service
 * container. Defaults to a SEPARATE `jobtrack_e2e` database on that same Postgres instance
 * (not the `jobtrack` one your own `pnpm dev` uses) — `pretest:e2e`
 * (server/scripts/reset-e2e-db.mjs) drops all its tables before every run, so it must never
 * point at a database with data you care about. `createdb jobtrack_e2e` (or any Postgres client)
 * once, if it doesn't already exist.
 *
 * Auth: the "setup" project (e2e/auth.setup.ts) registers one test user and saves its session
 * as storageState once; the "chromium" project depends on it and reuses that session for every
 * spec, so specs don't each pay for their own login.
 *
 * workers: 1 (not fullyParallel) — all E2E specs share ONE DB from a single running
 * server (no per-test data isolation). Roadmap/Plan21 are built dynamically from the
 * current state of vacancies (demand/gaps are recalculated on every request) — running in
 * parallel alongside a test that adds a vacancy (vacancies-kanban.spec.ts) would shift these
 * calculations between another test's steps and break it (a day/skill that existed at GET
 * time becomes invalid by the time of PUT). A sequential run costs a few extra seconds but
 * is deterministic.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE }, dependencies: ["setup"] },
  ],
  webServer: {
    // E2E must be fast, deterministic, and free — force offline mode
    // (dictionary-based analysis instead of real paid OpenAI/Anthropic calls), regardless
    // of whether keys are present in the developer/CI-runner environment. `env -u` strips
    // them for the child process (env.ts treats "unset" as offline, unlike "" — which fails min(1)).
    command: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY node server/dist/index.js`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack_e2e",
      BETTER_AUTH_SECRET: "e2e-test-secret-do-not-use-in-production",
      // Must match BASE_URL exactly (same scheme+host+port) — better-auth rejects requests
      // whose Origin doesn't match baseURL/trustedOrigins, and "localhost" vs "127.0.0.1" count
      // as different origins even though they're the same machine.
      BETTER_AUTH_URL: BASE_URL,
    },
  },
});
