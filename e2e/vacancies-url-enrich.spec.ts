import { test, expect } from "@playwright/test";
import { addVacancy } from "./helpers";

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

  // addVacancy() closes the detail modal the save opens, so the table's own url input underneath
  // — what this test exercises — is reachable. The vacancy is deliberately added WITHOUT a url:
  // the point is to save one afterwards, from the table.
  await addVacancy(page, { company: "New company", position: "Position" });

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
