import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест ключового флоу: генерація cover letter на сторінці CV в офлайн-режимі
 * (E2E примусово без API-ключів, див. playwright.config.ts) — сервер має повернути
 * детерміновану шаблонну відповідь (server/src/modules/writing/writing.routes.ts),
 * а не впасти чи зависнути без LLM.
 */
test("generates an offline cover letter on the CV page", async ({ page }) => {
  await page.goto("/cv");

  await page.getByPlaceholder("Текст вакансії…").fill("Шукаємо Full Stack розробника з досвідом Node.js та React.");
  await page.getByRole("button", { name: "Згенерувати лист" }).click();

  await expect(page.getByText(/Доброго дня!/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "⬇️ PDF" })).toBeVisible();
});
