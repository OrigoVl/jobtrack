import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест імпорту вакансій із зовнішнього JSON-файлу (job-tracker.json-подібний
 * формат: {company, pos, level, fit, status, applied, next, notes, url}) — ключовий флоу
 * "скинути файл і дані підтягнулись" (server/src/modules/vacancies/vacancies.routes.ts
 * POST /vacancies/import-json). Ідемпотентний (upsert за url), тож безпечний для повторних прогонів.
 *
 * URL навмисно НЕ на jobs.dou.ua: імпорт нових вакансій із посиланням автоматично намагається
 * стягнути стек (tryAutoEnrichStack), а це справжній мережевий запит. E2E має лишатись швидким,
 * детермінованим і офлайн (див. коментар у playwright.config.ts) — тому тут перевіряємо сам
 * імпорт, а не автозбагачення (те окремо покрите юніт-тестом vacancy-analysis.service.test.ts
 * з замоканим fetch).
 */
test("imports vacancies from a job-tracker.json-shaped file", async ({ page }) => {
  await page.goto("/vacancies");

  const payload = JSON.stringify([
    {
      company: "E2E Test Company",
      pos: "QA Automation Engineer",
      level: "Middle",
      fit: "high",
      status: "Відправив CV",
      applied: "2026-07-20",
      next: "",
      notes: "",
      url: "https://example.com/careers/e2e-test-999999",
    },
  ]);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vacancies/import-json") && r.request().method() === "POST"),
    page.getByLabel("Файл job-tracker.json для імпорту").setInputFiles({
      name: "job-tracker.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    }),
  ]);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { added: number; updated: number; skipped: number };
  // Ідемпотентний upsert за url: перший прогін цього файлу — "added", повторний (напр. локальний
  // ре-ран тесту без чистого e2e.db) — "updated". Обидва варіанти означають успішний імпорт.
  expect(body.added + body.updated).toBe(1);
  expect(body.skipped).toBe(0);

  // Тост підтверджує, що клієнт коректно показав результат користувачу.
  await expect(page.getByText(/додано 1|оновлено 1/)).toBeVisible();
});
