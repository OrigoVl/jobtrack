import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E config: spins up a production server build (build + node dist/index.js), which
 * itself serves the built frontend (client/dist) — we test the real build, not the dev
 * mode with a separate Vite proxy. An isolated DB via DB_PATH so we don't touch the local
 * jobtrack.db.
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
      DB_PATH: "./e2e/.tmp/e2e.db",
      NODE_ENV: "production",
      // Storage is still SQLite (DB_PATH above) — nothing reads this yet, it only satisfies
      // config/env.ts's production DATABASE_URL requirement (added ahead of the actual
      // Postgres/Drizzle swap later in the migration).
      DATABASE_URL: "postgres://jobtrack:jobtrack@localhost:5432/jobtrack",
    },
  },
});
