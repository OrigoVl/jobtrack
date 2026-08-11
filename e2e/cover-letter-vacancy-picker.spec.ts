import { test, expect } from "@playwright/test";
import { addVacancy } from "./helpers";

/**
 * End-to-end test of the cover-letter UX on /cover-letter (a tab of the CV section): previously the only source of vacancy
 * text was a manual textarea; now added (1) picking an EXISTING vacancy from the tracker
 * (auto-fills the textarea with position/company/stack/notes — client/src/features/cv/cv-shared.ts
 * vacancyToText) and (2) a link field with a "Load" button (server/src/modules/vacancies/
 * vacancies.routes.ts POST /vacancies/fetch-url, the same SSRF protection as in stack
 * auto-enrichment).
 *
 * Test (1) creates a vacancy and immediately selects
 * it in the dropdown on the cover-letter page — it's first in the list (GET /vacancies returns
 * ORDER BY id DESC, and the just-added one has the highest id). Test (2) deliberately uses a
 * private/internal address (169.254.169.254 — blocked by SSRF protection before any network
 * call), to stay offline/deterministic (see the comment in playwright.config.ts) while also
 * checking that the error is shown to the user as a toast, rather than silently hanging or
 * breaking the page.
 */
test("selecting a vacancy from the tracker fills the cover-letter textarea and enables the generate button", async ({ page }) => {
  await page.goto("/vacancies");
  await addVacancy(page, { company: "New company", position: "Position" });

  await page.goto("/cover-letter");
  const picker = page.getByLabel("Select a vacancy from the tracker for the cover letter");
  await expect(picker).toBeVisible();
  // A SearchSelect (shared/ui.tsx), not a <select>: click to open its list, then pick an option.
  // index 0 — the placeholder "— select a vacancy from the tracker —", index 1 — the newest
  // vacancy (highest id), which is the one this test just added.
  await picker.click();
  await page.getByRole("option").nth(1).click();

  const textarea = page.getByPlaceholder("…or paste the vacancy text manually");
  await expect(textarea).toHaveValue(/Position.*New company/s);

  const generateBtn = page.getByRole("button", { name: "Generate letter" });
  await expect(generateBtn).toBeEnabled();
});

test("fetching a cover-letter vacancy text from a private/internal url is blocked with a clear error toast", async ({ page }) => {
  await page.goto("/cover-letter");

  await page.getByPlaceholder("…or paste a vacancy link").fill("https://169.254.169.254/latest/meta-data/");
  await page.getByRole("button", { name: "Load" }).click();

  await expect(page.getByText(/Only https links are allowed|private IP address|local\/internal resource/)).toBeVisible();
  await expect(page.getByPlaceholder("…or paste the vacancy text manually")).toHaveValue("");
});
