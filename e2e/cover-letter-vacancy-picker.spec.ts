import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест нового UX cover letter на сторінці CV: раніше єднине джерело тексту вакансії
 * було ручне textarea; тепер додано (1) вибір ІСНУЮЧОЇ вакансії з трекера (автозаповнює textarea
 * позицією/компанією/стеком/нотатками — client/src/features/cv/cv.tsx vacancyToText) і
 * (2) поле для посилання з кнопкою "Завантажити" (server/src/modules/vacancies/vacancies.routes.ts
 * POST /vacancies/fetch-url, той самий SSRF-захист, що і в автозбагаченні стеку).
 *
 * Тест (1) створює вакансію з дефолтними "Позиція"/"Нова компанія" й одразу обирає її в
 * дропдауні на сторінці CV — вона першою в списку (GET /vacancies повертає ORDER BY id DESC,
 * а щойно додана має найбільший id). Тест (2) навмисно використовує приватну/внутрішню адресу
 * (169.254.169.254 — блокується SSRF-захистом ще до мережевого запиту), щоб лишатись
 * офлайн/детермінованим (див. коментар у playwright.config.ts) і водночас перевірити, що
 * помилка показується користувачу toast'ом, а не тихо висить/ламає сторінку.
 */
test("selecting a vacancy from the tracker fills the cover-letter textarea and enables the generate button", async ({ page }) => {
  await page.goto("/vacancies");
  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Додати вакансію" }).click(),
  ]);
  expect(addResponse.ok()).toBeTruthy();

  await page.goto("/cv");
  const select = page.getByLabel("Обрати вакансію з трекера для cover letter");
  await expect(select).toBeVisible();
  // index 0 — плейсхолдер "— обрати вакансію —", index 1 — найновіша вакансія (найбільший id).
  await select.selectOption({ index: 1 });

  const textarea = page.getByPlaceholder("…або встав текст вакансії вручну");
  await expect(textarea).toHaveValue(/Позиція.*Нова компанія/s);

  const generateBtn = page.getByRole("button", { name: "Згенерувати лист" });
  await expect(generateBtn).toBeEnabled();
});

test("fetching a cover-letter vacancy text from a private/internal url is blocked with a clear error toast", async ({ page }) => {
  await page.goto("/cv");

  await page.getByPlaceholder("…або встав посилання на вакансію").fill("https://169.254.169.254/latest/meta-data/");
  await page.getByRole("button", { name: "Завантажити" }).click();

  await expect(page.getByText(/Дозволені лише https-посилання|приватну IP-адресу|локальний\/внутрішній ресурс/)).toBeVisible();
  await expect(page.getByPlaceholder("…або встав текст вакансії вручну")).toHaveValue("");
});
