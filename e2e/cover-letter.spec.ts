import { test, expect } from "@playwright/test";

/**
 * End-to-end test of a key flow: generating a cover letter on the CV page in offline mode
 * (E2E is forced without API keys, see playwright.config.ts) — the server must return a
 * deterministic template response (server/src/modules/writing/writing.routes.ts),
 * not crash or hang without an LLM.
 */
test("generates an offline cover letter on the CV page", async ({ page }) => {
  await page.goto("/cv");

  await page
    .getByPlaceholder("…or paste the vacancy text manually")
    .fill("Looking for a Full Stack developer with Node.js and React experience.");
  await page.getByRole("button", { name: "Generate letter" }).click();

  await expect(page.getByText(/Hello!/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "⬇️ PDF" })).toBeVisible();
});
