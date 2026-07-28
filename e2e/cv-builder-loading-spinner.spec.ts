import { test, expect } from "@playwright/test";

/**
 * Regression test: AI-action buttons in the CV Builder used to only change their text to "…"
 * instead of a real animated spinner (`Btn loading` -> `<Spinner>` with `animate-spin`) — a user
 * reported not being able to tell whether anything was happening, since the text change was easy
 * to miss. Now `loading` shows an SVG icon.
 *
 * In real usage with an LLM key enabled, the request takes seconds — enough to see the spinner.
 * In E2E, the LLM is deliberately offline (determinism, playwright.config.ts) — offline analysis
 * responds almost instantly, so a normal click doesn't have time to "catch" the intermediate
 * state. We artificially delay this specific request via `page.route()` to check the spinner
 * deterministically, instead of relying on the random timing of a real network call.
 */
test("AI-analysis button shows a real animated spinner (not just text swap) while the request is in flight", async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/cv/review", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/cvbuilder");
  // "🔎 Tips" is the AI review result's tab label — it only exists once a report is already on
  // screen. The action that *triggers* the review from a clean page is the header's "AI
  // Assistant" button (see cv-builder.tsx's simplified toolbar).
  const btn = page.getByRole("button", { name: "🤖 AI Assistant" });
  await expect(btn).toBeVisible();
  await btn.click();

  const spinner = btn.locator("svg.animate-spin");
  await expect(spinner).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("aria-busy", "true");

  releaseResponse?.();
  await expect(spinner).not.toBeVisible();
  await expect(btn).toBeEnabled();
});
