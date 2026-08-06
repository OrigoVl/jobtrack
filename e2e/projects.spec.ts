import { test, expect } from "@playwright/test";

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
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});
