import { test, expect } from "@playwright/test";

/**
 * End-to-end test of importing vacancies from an external JSON file (job-tracker.json-shaped
 * format: {company, pos, level, fit, status, applied, next, notes, url}) — the key
 * "drop a file and the data fills in" flow (server/src/modules/vacancies/vacancies.routes.ts
 * POST /vacancies/import-json). Idempotent (upsert by url), so safe to run repeatedly.
 *
 * The URL is deliberately NOT on jobs.dou.ua: importing a new vacancy with a link automatically
 * tries to pull in the stack (tryAutoEnrichStack), which is a real network request. E2E must
 * stay fast, deterministic, and offline (see the comment in playwright.config.ts) — so here we
 * check the import itself, not auto-enrichment (that's covered separately by the unit test
 * vacancy-analysis.service.test.ts with a mocked fetch).
 */
test("imports vacancies from a job-tracker.json-shaped file", async ({ page }) => {
  await page.goto("/vacancies");

  const payload = JSON.stringify([
    {
      company: "E2E Test Company",
      pos: "QA Automation Engineer",
      level: "Middle",
      fit: "high",
      status: "Applied",
      applied: "2026-07-20",
      next: "",
      notes: "",
      url: "https://example.com/careers/e2e-test-999999",
    },
  ]);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vacancies/import-json") && r.request().method() === "POST"),
    page.getByLabel("job-tracker.json file to import").setInputFiles({
      name: "job-tracker.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    }),
  ]);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { added: number; updated: number; skipped: number };
  // Idempotent upsert by url: the first run of this file — "added", a repeat run (e.g. a local
  // rerun of the test without a clean e2e.db) — "updated". Either outcome means a successful import.
  expect(body.added + body.updated).toBe(1);
  expect(body.skipped).toBe(0);

  // The toast confirms the client correctly showed the result to the user.
  await expect(page.getByText(/added 1|updated 1/)).toBeVisible();
});
