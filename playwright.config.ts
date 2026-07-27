import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E-конфіг: піднімає збірку продакшн-сервера (build + node dist/index.js), який сам
 * роздає зібраний фронтенд (client/dist), — тестуємо реальний білд, а не dev-режим
 * з окремим Vite-проксі. Ізольована БД через DB_PATH, щоб не чіпати локальну jobtrack.db.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // E2E має бути швидким, детермінованим і безкоштовним — примусово офлайн-режим
    // (словниковий аналіз замість реальних платних викликів OpenAI/Anthropic), незалежно
    // від того, чи є ключі в оточенні розробника/CI-раннера. `env -u` знімає їх для
    // дочірнього процесу (env.ts трактує "не задано" як офлайн, на відміну від "" — не проходить min(1)).
    command: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY node server/dist/index.js`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      DB_PATH: "./e2e/.tmp/e2e.db",
      NODE_ENV: "production",
    },
  },
});
