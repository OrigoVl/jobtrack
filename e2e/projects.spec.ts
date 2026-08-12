import { test, expect } from "@playwright/test";

/**
 * The item this test ticked, so it can be unticked again. Progress lives in `user_kv` against the
 * shared e2e account and the suite runs on a persistent database, so without this the very first
 * assertion below — that the item starts UNticked — is true exactly once per fresh DB, and every
 * later local run fails on it. Taken from the PUT's own request body rather than from the DOM:
 * the checkbox carries no id the test could read.
 */
let tickedItemId: string | null = null;

test.afterEach(async ({ page }) => {
  if (!tickedItemId) return;
  await page.request.put("/api/projects/progress", { data: { itemId: tickedItemId, done: false } });
  tickedItemId = null;
});

/**
 * End-to-end test of the pet-projects ladder (features/projects/projects.tsx ->
 * GET/PUT /api/projects). E2E always runs with the LLM offline (see playwright.config.ts), so
 * this exercises the static-ladder fallback (projects.service.ts's getDynamicProjects() returning
 * personalized: false) — the AI-personalized generation path itself is covered by
 * projects.service.test.ts (mocked chatJson, no real network needed there either). Same
 * "toggle -> reload -> still checked" pattern as plan21.spec.ts/roadmap.spec.ts.
 */
test("marks a pet-project DoD item as done and persists it across reload", async ({ page }) => {
  await page.goto("/projects");

  const checkbox = page.getByRole("checkbox").first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  // Optimistic mutation (shared/queries/projects.ts) — wait for the real PUT response before
  // reloading, or the reload could race a request that hasn't reached the server yet.
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/projects/progress") && res.request().method() === "PUT"),
    checkbox.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  tickedItemId = (response.request().postDataJSON() as { itemId: string }).itemId;
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});
