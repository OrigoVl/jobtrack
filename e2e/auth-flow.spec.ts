// Phase 8: the one area of auth/admin behavior none of the other 11 specs exercise — they all
// run against the ALREADY-authenticated shared session (project-level storageState, see
// playwright.config.ts). Tests here that need a DIFFERENT auth state (signed out, a second
// user, an admin) explicitly open their own `browser.newContext()` instead of using the default
// `page` fixture — critical, because all specs in this run share one storageState.json AND one
// database (workers: 1): logging out through the shared/default context would invalidate the
// session every other spec relies on for the rest of the run.
import { test, expect, type APIRequestContext } from "@playwright/test";
import { skipWelcome } from "./helpers";
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

/**
 * Regression test: registering through the FORM (every other spec, and auth.setup.ts, register
 * through the API instead, so this path had no coverage at all). `signUp.email()` makes
 * better-auth's client refetch the session, which flips `useSession().isPending` back to true —
 * and App.tsx's PublicRoute used to render nothing whenever that was true, unmounting the very
 * page that had just submitted. The account was created and the verification email sent, but the
 * "check your email" screen never appeared and the typed-in fields were wiped: pressing "Create
 * account" looked like it did nothing whatsoever.
 */
test("registering through the form lands on the check-your-email screen, and really creates the account", async ({ browser }) => {
  const email = `form-signup-${Date.now()}@example.test`;
  // Its own signed-out context — the default `page` fixture carries the shared authenticated
  // session (see this file's header), and /register would just bounce it to the dashboard.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/register");

  await page.getByPlaceholder("Name").fill("Form Signup");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Check your email")).toBeVisible();
  // Still on /register (the screen replaces the form in place) — asserted so a future redirect
  // can't quietly satisfy the check above from some other page.
  expect(new URL(page.url()).pathname).toBe("/register");

  const rows = await withDb((client) => client.query('SELECT email_verified FROM "user" WHERE email = $1', [email]));
  expect(rows.rowCount).toBe(1);
  expect(rows.rows[0].email_verified).toBe(false);
  await context.close();
});

test("an unauthenticated visitor hitting a protected route is redirected to /login", async ({ browser }) => {
  // Playwright Test's `browser` fixture inherits the project's configured context defaults —
  // including "chromium"'s `storageState: AUTH_FILE` (playwright.config.ts) — for ANY
  // `browser.newContext()` call, not just the automatic `page`/`context` fixtures. An empty
  // storageState here overrides that, so this is a genuinely signed-out session, not a copy of
  // the shared authenticated one.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  // waitUntil "commit" — same reason as the logout test below: the guard's redirect can abort
  // this navigation's own load, and that redirect is exactly what's being asserted.
  await page.goto("/dashboard", { waitUntil: "commit" });
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
  // This user has never logged in before, so the app parks it on /welcome first.
  await skipWelcome(page);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("**/login");
  // Landing on the URL isn't the same as the page having settled: log-out also clears the query
  // cache and tears the app shell down, and a navigation started while that's still unwinding
  // gets cancelled (net::ERR_ABORTED) before the reload below can even commit. Waiting for the
  // login form to actually render is the cheap "the app is idle again" signal.
  await expect(page.getByPlaceholder("Email")).toBeVisible();

  // Not just "the SPA's router redirected" (a client-side-only guard could pass this while the
  // server-side session is still technically valid) — reload straight into the protected route
  // and confirm the server itself rejects it too. waitUntil "commit": the app bounces to /login
  // as soon as the session check comes back, which can abort the /dashboard load before it fires
  // "load" (net::ERR_ABORTED) — the redirect IS the assertion here, so waiting for the aborted
  // page to finish loading is both unnecessary and flaky.
  await page.goto("/dashboard", { waitUntil: "commit" });
  await page.waitForURL("**/login");
  await context.close();
});

test("a regular (non-admin) user never sees the Admin nav item and is bounced away from /admin", async ({ page }) => {
  // Uses the default, already-authenticated shared session (project storageState) — read-only
  // navigation/assertions here, nothing that mutates auth state for other specs.
  await page.goto("/dashboard");
  await expect(page.locator("aside").getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.goto("/admin", { waitUntil: "commit" });
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
  await skipWelcome(page);

  const adminLink = page.locator("aside").getByRole("link", { name: "Admin" });
  await expect(adminLink).toBeVisible();
  await adminLink.click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await context.close();
});
