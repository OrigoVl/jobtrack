import { test, expect, type Page } from "@playwright/test";

/**
 * The LinkedIn optimizer card on the CV page (features/cv/linkedin-optimizer-card.tsx), in offline
 * mode — E2E always runs without API keys (see playwright.config.ts), so the server must return
 * its deterministic template (cv-linkedin.service.ts's offlineLinkedInOptimize) rather than
 * failing. Covers the three things that make the card usable and that unit tests can't see: the
 * generated text renders with its character budget, the pasted profile gets scored, and the
 * target-language picker is a real choice separate from the app's own UI language.
 */
const optimizerCard = (page: Page) => page.getByRole("region", { name: "LinkedIn profile optimizer" });

/**
 * The generate button, by either label. Generating PERSISTS the result (a `user_kv` blob), and the
 * e2e account is shared across spec files — so by the second spec to run, the card restores that
 * saved profile and the button reads "↻ Regenerate" instead of "Generate". Matching on the exact
 * first-run label would make every spec but the first one fail, in an order-dependent way.
 */
const generateButton = (page: Page) => optimizerCard(page).getByRole("button", { name: /generate/i });

test("generates an offline LinkedIn profile and shows each field's character budget", async ({ page }) => {
  await page.goto("/cv");

  await generateButton(page).click();

  await expect(page.getByText(/Offline template/)).toBeVisible({ timeout: 15_000 });
  // LinkedIn's own hard limits — the counters are the only place the user finds out that a
  // headline won't fit before pasting it into LinkedIn and watching it truncate.
  await expect(optimizerCard(page).getByText(/\/220$/)).toBeVisible();
  await expect(optimizerCard(page).getByText(/\/2600$/)).toBeVisible();
});

test("pasting the profile you already have scores it against LinkedIn's own rules", async ({ page }) => {
  await page.goto("/cv");

  const card = optimizerCard(page);
  await card.getByText(/Already have a LinkedIn profile/).click();
  await card.getByLabel("Your current headline").fill("Dreamer. Doer. Coffee lover.");
  await generateButton(page).click();

  // The audit is deterministic (linkedin-market.ts) — it runs identically with no LLM, which is
  // exactly why it's assertable here at all.
  await expect(card.getByText("Your current profile")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText(/"About" is filled in/)).toBeVisible();
});

test("the target language is chosen independently of the app's own language", async ({ page }) => {
  await page.goto("/cv");

  const card = optimizerCard(page);
  // The app UI stays in English here; picking Ukrainian must still produce a Ukrainian profile,
  // because which language a LinkedIn profile needs depends on the market being targeted.
  await card.getByRole("button", { name: "Українська" }).click();
  await generateButton(page).click();

  await expect(card.getByText(/практичним досвідом/)).toBeVisible({ timeout: 15_000 });
});
