import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест поля "Посилання" в таблиці вакансій: збереження URL має тригерити PUT-запит і
 * показувати toast зі статусом автозбагачення (server/src/modules/vacancies/
 * vacancy-analysis.service.ts tryAutoEnrichStack). Раніше автозбагачення дозволяло лише
 * jobs.dou.ua (allowlist); тепер дозволений будь-який публічний https-хост, а блокуються лише
 * локальні/внутрішні адреси (SSRF-захист, assertSafeVacancyUrl у shared/validation.ts) — саме
 * таку URL і використовуємо тут (169.254.169.254 — класична адреса cloud-metadata сервісів,
 * популярна ціль SSRF), щоб перевірити гілку "заблоковано" без реального мережевого запиту
 * (E2E має лишатись офлайн/детермінованим — див. коментар у playwright.config.ts). Happy-path
 * автозбагачення з довільного публічного домену покритий юніт-тестом
 * vacancy-analysis.service.test.ts (мокнутий fetch — там реальна мережа так само не потрібна).
 *
 * Ідентифікуємо щойно додану вакансію ПОЗИЦІЄЮ першого рядка таблиці (найновіші зверху,
 * ORDER BY id DESC), а не назвою компанії — дефолтне "Нова компанія" не унікальне: інші E2E-
 * специфікації в тій самій спільній БД (workers: 1) теж лишають рядки з такою назвою.
 */
test("saving a vacancy url pointing at a private/internal address is blocked without a network call (SSRF guard)", async ({ page }) => {
  await page.goto("/vacancies");

  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Додати вакансію" }).click(),
  ]);
  expect(addResponse.ok()).toBeTruthy();

  const urlInput = page
    .locator("table tbody tr")
    .first()
    .getByPlaceholder("Посилання на вакансію (з будь-якого сайту) → стек підтягнеться сам…");
  await expect(urlInput).toBeVisible();
  await urlInput.fill("https://169.254.169.254/latest/meta-data/");

  const [putResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies\/\d+$/.test(r.url()) && r.request().method() === "PUT"),
    urlInput.blur(),
  ]);
  expect(putResponse.ok()).toBeTruthy();

  await expect(page.getByText(/не вдалося автоматично розпізнати стек/)).toBeVisible();
});
