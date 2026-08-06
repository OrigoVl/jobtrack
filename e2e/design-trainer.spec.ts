import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the architecture trainer's wiring. E2E always runs with the LLM offline (no
 * API keys in CI, see playwright.config.ts) — task generation is fully AI-generated (no offline
 * heuristic, same accepted shape as mock-interview.service.ts's live interview), so the only
 * deterministically-testable path here is that offline case: POST /design/task must come back
 * with `offline: true` and the UI must show that clearly instead of hanging or silently failing.
 */
test("opening the Architecture tab and asking for a task while AI is offline shows a clear offline notice", async ({ page }) => {
  await page.goto("/study");

  await page.getByRole("button", { name: "Architecture" }).click();
  await expect(page.getByText("No task yet")).toBeVisible();

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/design/task") && res.request().method() === "POST"),
    page.getByRole("button", { name: "New task" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.offline).toBe(true);
  expect(body.task).toBeNull();

  await expect(page.getByText("AI offline — set a key in server/.env to generate a task.")).toBeVisible();
  // No task was generated — the empty state (not a diagram canvas) is still what's shown.
  await expect(page.getByText("No task yet")).toBeVisible();
});
