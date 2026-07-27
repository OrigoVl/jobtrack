import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест ключового флоу: відмітка дня в 21-денному інтенсиві як виконаного
 * (features/plan21/plan21.tsx -> POST /api/plan21/day) і збереження прогресу на бекенді —
 * перевіряємо, що чекбокс лишається відміченим після перезавантаження сторінки.
 */
test("marks a plan21 day as done and persists it across reload", async ({ page }) => {
  await page.goto("/plan21");

  const checkbox = page.getByRole("checkbox").first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  // Мутація оптимістична (UI оновлюється миттєво, до відповіді сервера) — чекаємо на
  // мережеву відповідь PUT /api/plan21/progress, інакше reload() нижче може перервати ще
  // не завершений запит, і сервер так і не збереже зміну (флейкі тест).
  // .click() замість .check(): чекбокс контрольований React-пропом `checked` (не нативним
  // станом), тож вбудована перевірка .check() "чи справді змінився стан" може зловити кадр
  // до того, як оптимістичне оновлення долетить у пропс — нижній expect().toBeChecked()
  // сам ретраїть до фактичного результату.
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/plan21/progress") && res.request().method() === "PUT"),
    checkbox.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});
