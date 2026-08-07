// Runs once before every spec (see playwright.config.ts's "setup" project + the "chromium"
// project's dependency on it): registers one test user and saves its session as storageState,
// so every actual spec starts already logged in without repeating this flow per-file.
//
// requireEmailVerification is on (server/src/auth/auth.ts) and e2e runs with no email provider
// configured (RESEND_API_KEY unset, same "force offline" policy as the LLM keys — see
// playwright.config.ts), so the verification link only exists in the server's logs, not an
// inbox. Rather than scrape stdout for it, this connects directly to the same Postgres the
// e2e server uses and flips `email_verified` — deterministic, no log-parsing.
import { test as setup, expect } from "@playwright/test";
import pg from "pg";

const AUTH_FILE = "e2e/.auth/user.json";
const EMAIL = "e2e@example.test";
const PASSWORD = "password1234";

setup("authenticate", async ({ page, baseURL }) => {
  const signUpRes = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email: EMAIL, password: PASSWORD, name: "E2E Test User" },
  });
  expect(signUpRes.ok()).toBeTruthy();

  // Must match playwright.config.ts's own webServer DATABASE_URL default — this needs to be the
  // exact same database the e2e server process is actually using.
  const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack_e2e";
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('UPDATE "user" SET email_verified = true WHERE email = $1', [EMAIL]);
  await client.end();

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  // Either landing page proves the session is live. A freshly-registered user has
  // onboarding.welcomeSeen=false, so App.tsx's WelcomeRedirect bounces it to /welcome — whether
  // /dashboard is ever painted on the way is a race this setup must not depend on (waiting for
  // /dashboard alone times out whenever the redirect wins).
  await page.waitForURL(/\/(dashboard|welcome)$/);

  // Mark onboarding done directly, so every spec reusing this storageState lands on its target
  // route instead of being bounced to /welcome.
  await page.request.post("/api/onboarding/welcome-seen", { headers: { origin: baseURL! } });

  await page.context().storageState({ path: AUTH_FILE });
});
