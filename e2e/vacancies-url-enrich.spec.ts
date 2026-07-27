import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест нового поля "Посилання" в таблиці вакансій: збереження URL має тригерити
 * PUT-запит і показувати toast зі статусом автозбагачення (server/src/modules/vacancies/
 * vacancy-analysis.service.ts tryAutoEnrichStack). URL навмисно НЕ на jobs.dou.ua, щоб
 * перевірити гілку "домен не підтримується" без реального мережевого запиту (E2E має
 * лишатись офлайн/детермінованим — див. коментар у playwright.config.ts); сам happy-path
 * автозбагачення з jobs.dou.ua покритий юніт-тестом vacancy-analysis.service.test.ts.
 *
 * Ідентифікуємо щойно додану вакансію ПОЗИЦІЄЮ першого рядка таблиці (найновіші зверху,
 * ORDER BY id DESC), а не назвою компанії — дефолтне "Нова компанія" не унікальне: інші E2E-
 * специфікації в тій самій спільній БД (workers: 1) теж лишають рядки з такою назвою.
 */
test("saving a non-dou.ua vacancy url shows the unsupported-domain toast without a network call", async ({ page }) => {
  await page.goto("/vacancies");

  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Додати вакансію" }).click(),
  ]);
  expect(addResponse.ok()).toBeTruthy();

  const urlInput = page.locator("table tbody tr").first().getByPlaceholder("Посилання (jobs.dou.ua → стек підтягнеться сам)…");
  await expect(urlInput).toBeVisible();
  await urlInput.fill("https://example.com/careers/123");

  const [putResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies\/\d+$/.test(r.url()) && r.request().method() === "PUT"),
    urlInput.blur(),
  ]);
  expect(putResponse.ok()).toBeTruthy();

  await expect(page.getByText(/автопідтягування стеку працює лише для jobs\.dou\.ua/)).toBeVisible();
});
