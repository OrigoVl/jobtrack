import { test, expect } from "@playwright/test";

/**
 * End-to-end test of job alerts (saved searches) — features/jobs/jobs.tsx's "🔔 Alert me"
 * button + server/src/modules/saved-searches/. Deliberately doesn't click "🔎 Search" first
 * (that hits real external job aggregators over the network — slow/flaky) — creating an alert
 * only needs the typed query text and region, both already in local state before any search runs.
 */
test("creates a job alert and can delete it, persisting across reload", async ({ page }) => {
  await page.goto("/jobs");

  const query = "E2E Rust Developer Alert";
  await page.getByLabel("Keywords for the job search").fill(query);

  const [createRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/saved-searches") && r.request().method() === "POST"),
    page.getByRole("button", { name: "🔔 Alert me" }).click(),
  ]);
  expect(createRes.ok()).toBeTruthy();

  await expect(page.getByText(query, { exact: true })).toBeVisible();
  // The button disables once an alert already exists for this exact query/region.
  await expect(page.getByRole("button", { name: "🔔 Alert me" })).toBeDisabled();

  await page.reload();
  await expect(page.getByText(query, { exact: true })).toBeVisible();

  const [deleteRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/saved-searches/") && r.request().method() === "DELETE"),
    page.getByRole("button", { name: `Delete alert for ${query}` }).click(),
  ]);
  expect(deleteRes.ok()).toBeTruthy();
  await expect(page.getByText(query, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(query, { exact: true })).toHaveCount(0);
});
