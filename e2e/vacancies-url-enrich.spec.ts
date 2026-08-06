import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the "Link" field in the vacancies table: saving a URL must trigger a PUT
 * request and show a toast with the auto-enrichment status (server/src/modules/vacancies/
 * vacancy-analysis.service.ts tryAutoEnrichStack). Auto-enrichment used to only allow
 * jobs.dou.ua (an allowlist); now any public https host is allowed, and only local/internal
 * addresses are blocked (SSRF protection, assertSafeVacancyUrl in shared/validation.ts) — that's
 * exactly the kind of URL we use here (169.254.169.254 — the classic cloud-metadata service
 * address, a popular SSRF target), to test the "blocked" branch without a real network call
 * (E2E must stay offline/deterministic — see the comment in playwright.config.ts). The happy
 * path of auto-enrichment from an arbitrary public domain is covered by the unit test
 * vacancy-analysis.service.test.ts (mocked fetch — no real network needed there either).
 *
 * We identify the just-added vacancy by the POSITION of the first table row (newest on top,
 * ORDER BY id DESC), not by company name — the default "New company" isn't unique: other E2E
 * specs in the same shared DB (workers: 1) also leave rows with that name.
 */
test("saving a vacancy url pointing at a private/internal address is blocked without a network call (SSRF guard)", async ({ page }) => {
  await page.goto("/vacancies");

  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  expect(addResponse.ok()).toBeTruthy();
  // "+ Add vacancy" now opens the detail modal for filling it in right away (vacancy-detail-modal.tsx)
  // — close it to reach the table's own url input underneath, which is what this test exercises.
  // Waiting for it to actually be visible first matters: it opens from the add-mutation's success
  // callback, a render cycle after the awaited network response above, so it isn't necessarily
  // on-screen yet.
  const addDialog = page.getByRole("dialog");
  await expect(addDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addDialog).not.toBeVisible();

  const urlInput = page.locator("table tbody tr").first().getByPlaceholder("Vacancy link (from any site) → the stack fills in itself…");
  await expect(urlInput).toBeVisible();
  await urlInput.fill("https://169.254.169.254/latest/meta-data/");

  const [putResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies\/\d+$/.test(r.url()) && r.request().method() === "PUT"),
    urlInput.blur(),
  ]);
  expect(putResponse.ok()).toBeTruthy();

  await expect(page.getByText(/could not automatically detect the stack/)).toBeVisible();
});
