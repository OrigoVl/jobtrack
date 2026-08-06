import { test, expect, type APIRequestContext, type Browser, type Page, type BrowserContext } from "@playwright/test";
import pg from "pg";

/**
 * End-to-end test of the /welcome onboarding flow (features/welcome/welcome.tsx) — the first
 * screen a brand-new signup sees (app/App.tsx's WelcomeRedirect bounces any account whose
 * server-side `onboarding.welcomeSeen` flag is still false there, from anywhere in the app).
 *
 * Deliberately does NOT use the shared, already-authenticated session (project storageState, see
 * playwright.config.ts) the way most other specs do — that user is long past this one-time
 * screen by the time any other spec runs. Like auth-flow.spec.ts's admin/logout tests, each test
 * here registers its own throwaway user and opens its own signed-out `browser.newContext()`, so
 * it actually observes a first-ever login.
 */

const PASSWORD = "password1234";

async function registerAndVerify(request: APIRequestContext, baseURL: string, email: string): Promise<void> {
  const res = await request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password: PASSWORD, name: "Welcome Flow Test" },
  });
  expect(res.ok()).toBeTruthy();

  // Same reasoning as auth.setup.ts: requireEmailVerification is on and e2e has no email
  // provider configured, so flip the flag directly in the same Postgres the e2e server uses.
  const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack_e2e";
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('UPDATE "user" SET email_verified = true WHERE email = $1', [email]);
  await client.end();
}

/** Registers a fresh user, logs them in from a genuinely signed-out context, and waits for the
 * first-login redirect to land on /welcome. */
async function loginAsFreshUser(
  browser: Browser,
  request: APIRequestContext,
  baseURL: string,
  email: string,
): Promise<{ context: BrowserContext; page: Page }> {
  await registerAndVerify(request, baseURL, email);

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/welcome");
  return { context, page };
}

test("a brand-new signup sets a target role, finishes the flow, and is never sent back to /welcome afterward", async ({
  browser,
  request,
  baseURL,
}) => {
  const email = `welcome-${Date.now()}@example.test`;
  const { context, page } = await loginAsFreshUser(browser, request, baseURL!, email);

  await expect(page.getByText("Step 1 of 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Zorya" })).toBeVisible();

  await page.getByPlaceholder("e.g. Backend Developer, Product Designer").fill("Backend Developer");

  // "Continue" saves the role to the profile (PUT /api/profile) before advancing to step 2.
  const [saveRes] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/profile") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  expect(saveRes.ok()).toBeTruthy();
  expect(((await saveRes.json()) as { domain: string }).domain).toBe("Backend Developer");

  await expect(page.getByText("Step 2 of 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You're set up" })).toBeVisible();

  // Finishing marks onboarding.welcomeSeen server-side (POST /api/onboarding/welcome-seen) and
  // routes to Vacancies.
  const [finishRes] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/onboarding/welcome-seen") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Add my first vacancy" }).click(),
  ]);
  expect(finishRes.ok()).toBeTruthy();
  await page.waitForURL("**/vacancies");

  // The account is now past onboarding — a fresh visit anywhere in the app must never bounce it
  // back to /welcome again (the whole point of persisting the flag server-side).
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome to Zorya" })).toHaveCount(0);

  await context.close();
});

test("skipping from step 1 marks onboarding done and goes straight to the dashboard, without ever saving a role", async ({
  browser,
  request,
  baseURL,
}) => {
  const email = `welcome-skip-${Date.now()}@example.test`;
  const { context, page } = await loginAsFreshUser(browser, request, baseURL!, email);

  await expect(page.getByRole("heading", { name: "Welcome to Zorya" })).toBeVisible();

  // "Skip setup" is available from step 1 too (it's rendered outside the step-1/step-2
  // conditional) — must never fire a PUT /api/profile on its way out.
  let profileSaveFired = false;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/profile") && req.method() === "PUT") profileSaveFired = true;
  });

  const [finishRes] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/onboarding/welcome-seen") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Skip setup" }).click(),
  ]);
  expect(finishRes.ok()).toBeTruthy();
  await page.waitForURL("**/dashboard");
  expect(profileSaveFired).toBe(false);

  await context.close();
});
