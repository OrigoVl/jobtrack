import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the live voice mock interview's wiring. E2E always runs with the LLM
 * offline (no API keys in CI, see playwright.config.ts) — a live interview's whole value is
 * AI-generated questions, so the only deterministically-testable path here is the offline one:
 * POST /mock/interview must come back with `offline: true` and the UI must show that clearly
 * instead of hanging or crashing (server/src/modules/mock/mock-interview.service.ts).
 */
test("starting a live interview while AI is offline shows a clear offline notice", async ({ page }) => {
  await page.goto("/study");

  await page.getByRole("button", { name: "Mock interview" }).click();
  await page.getByRole("button", { name: "Live interview" }).click();

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/mock/interview") && res.request().method() === "POST"),
    page.getByRole("button", { name: "▶ Start interview" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.offline).toBe(true);

  await expect(page.getByText("AI offline — couldn't continue the interview.")).toBeVisible();
});

/**
 * Regression guard for the mock.tsx restructure (PoolInterview + VoiceInterview under one
 * pool/live sub-mode toggle): toggling to Live interview and back must not corrupt the pool
 * flow's own start screen or its persisted state.
 */
test("toggling from Live interview back to the practice pool still renders its start screen", async ({ page }) => {
  await page.goto("/study");

  await page.getByRole("button", { name: "Mock interview" }).click();
  await page.getByRole("button", { name: "Live interview" }).click();
  await expect(page.getByRole("button", { name: "▶ Start interview" })).toBeVisible();

  await page.getByRole("button", { name: "Practice pool" }).click();
  await expect(page.getByRole("button", { name: "▶ Start" })).toBeVisible();
});
