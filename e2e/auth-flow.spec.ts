// Phase 8: the one area of auth/admin behavior none of the other 11 specs exercise — they all
// run against the ALREADY-authenticated shared session (project-level storageState, see
// playwright.config.ts). Tests here that need a DIFFERENT auth state (signed out, a second
// user, an admin) explicitly open their own `browser.newContext()` instead of using the default
// `page` fixture — critical, because all specs in this run share one storageState.json AND one
// database (workers: 1): logging out through the shared/default context would invalidate the
// session every other spec relies on for the rest of the run.
import { test, expect, type APIRequestContext } from "@playwright/test";
import pg from "pg";

const DB_URL = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack_e2e";
const PASSWORD = "password1234";

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Same shape as auth.setup.ts's own registration step — `request` resolves relative URLs
// against the configured baseURL, so this works unchanged whatever port/host the run uses.
async function registerAndVerify(request: APIRequestContext, baseURL: string, email: string): Promise<void> {
  const res = await request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password: PASSWORD, name: "Auth Flow Test" },
  });
  expect(res.ok()).toBeTruthy();
  await withDb((client) => client.query('UPDATE "user" SET email_verified = true WHERE email = $1', [email]));
}

test("an unauthenticated visitor hitting a protected route is redirected to /login", async ({ browser }) => {
  // Playwright Test's `browser` fixture inherits the project's configured context defaults —
  // including "chromium"'s `storageState: AUTH_FILE` (playwright.config.ts) — for ANY
  // `browser.newContext()` call, not just the automatic `page`/`context` fixtures. An empty
  // storageState here overrides that, so this is a genuinely signed-out session, not a copy of
  // the shared authenticated one.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.waitForURL("**/login");
  await context.close();
});

test("logging out invalidates the session server-side — a direct visit to a protected route afterward redirects to /login, not stale content", async ({
  browser,
  request,
  baseURL,
}) => {
  const email = `logout-${Date.now()}@example.test`;
  await registerAndVerify(request, baseURL!, email);

  // See the previous test's comment — must override the project's default storageState so
  // this starts signed out, and logs in as THIS test's own throwaway user, not the shared one.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");

  // Not just "the SPA's router redirected" (a client-side-only guard could pass this while the
  // server-side session is still technically valid) — reload straight into the protected route
  // and confirm the server itself rejects it too.
  await page.goto("/dashboard");
  await page.waitForURL("**/login");
  await context.close();
});

test("a regular (non-admin) user never sees the Admin nav item and is bounced away from /admin", async ({ page }) => {
  // Uses the default, already-authenticated shared session (project storageState) — read-only
  // navigation/assertions here, nothing that mutates auth state for other specs.
  await page.goto("/dashboard");
  await expect(page.locator("aside").getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.goto("/admin");
  await page.waitForURL("**/dashboard");
});

test("a promoted admin sees the Admin nav item and can load the admin panel", async ({ browser, request, baseURL }) => {
  const email = `admin-${Date.now()}@example.test`;
  await registerAndVerify(request, baseURL!, email);
  await withDb((client) => client.query('UPDATE "user" SET role = $1 WHERE email = $2', ["admin", email]));

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");

  const adminLink = page.locator("aside").getByRole("link", { name: "Admin" });
  await expect(adminLink).toBeVisible();
  await adminLink.click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await context.close();
});
