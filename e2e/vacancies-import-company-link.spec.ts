import { test, expect } from "./fixtures";

/**
 * POST /vacancies/import (paste a DOU export or any list of job links) used to guess the employer
 * name from the URL's own slug (companyFromDouUrl) but only ever write it as the vacancy's
 * free-text `company` field — never create/link an actual `companies` row. The detail modal only
 * renders the linked-company picker (no free-text field), so every imported vacancy showed "No
 * linked company" regardless of whether the name was guessed correctly. Now the import upserts
 * the company (non-destructive, same as the single-vacancy "Add"/"Refresh from link" flows) and
 * links it for real — see vacancies.repo.ts's updateVacancyImportedTitle and vacancies.routes.ts's
 * POST /vacancies/import.
 *
 * Uses a jobs.dou.ua link with a fabricated slug/id: the company name comes for free from the
 * URL's own path structure (no LLM, no CV text), and the actual GET to that (nonexistent) posting
 * — used only for stack/level/fit enrichment afterward — fails fast (real host, 404) rather than
 * hanging, so this stays fast without needing to fake network access.
 */

test("importing a DOU link creates AND links the real company row, not just the free-text name", async ({ page }) => {
  await page.goto("/vacancies");

  const slug = `qa-e2e-import-co-${Date.now()}`;
  const expectedCompanyName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const html = `https://jobs.dou.ua/companies/${slug}/vacancies/999999/`;

  const [importRes] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies\/import$/.test(r.url()) && r.request().method() === "POST"),
    (async () => {
      await page.getByRole("button", { name: "Import" }).click();
      await page.getByLabel("HTML or text containing vacancy links to import").fill(html);
      await page.getByRole("button", { name: "Import links" }).click();
    })(),
  ]);
  const importBody = await importRes.json();
  expect(importBody.added).toBe(1);
  expect(importBody.items[0].company).toBe(expectedCompanyName);

  // Confirm the linked-company picker shows the real row (not "No linked company") by opening the
  // imported vacancy's detail modal from the table — proves the id was actually written, not just
  // the display name matching by coincidence.
  await page.reload();
  await page
    .getByRole("button", { name: new RegExp(`Open details for .* at ${expectedCompanyName}`) })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Linked company")).toHaveValue(expectedCompanyName);
});
