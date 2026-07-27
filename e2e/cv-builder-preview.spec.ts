import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест прев'ю-панелі Конструктора CV (features/cv/builder/cv-preview-panel.tsx):
 * бейдж кількості сторінок і fullscreen-режим на весь екран.
 *
 * Fullscreen-модалка навмисно перевіряється саме E2E (а не unit-тестом): у певний момент
 * (до фіксу в index.css) вона мала pixel-perfect позиціонуватись відносно справжнього
 * вьюпорту `position: fixed`, але через глобальну CSS-анімацію `main > *` з
 * `animation-fill-mode: both` (transform лишався в computed style навіть після завершення
 * анімації) прямий нащадок <main> ставав containing block для fixed-нащадків — модалка
 * рендерилась відносно контенту сторінки, а не вьюпорту, і не покривала бічний сайдбар.
 * jsdom/vitest не рендерить справжній layout/CSS-каскад, тож така регресія непомітна
 * без реального браузера.
 */
test("CV preview shows a page-count badge and opens/closes a real fullscreen overlay", async ({ page }) => {
  await page.goto("/cvbuilder");

  const badge = page.getByTitle(/сторінок при друку в PDF/);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/стор\.$/);

  const openFullscreen = page.getByRole("button", { name: "⛶" });
  await openFullscreen.click();

  const modalHeading = page.getByText("Прев'ю CV", { exact: true });
  await expect(modalHeading).toBeVisible();

  // Справжня fixed-модалка — position:fixed відносно вьюпорту, не якогось скрольованого
  // предка сторінки: bounding box має починатись близько до (0,0) вьюпорту, а не десь
  // посеред довгого контенту сторінки (саме так виглядав описаний вище баг).
  const overlay = page.locator("div.fixed.inset-0.z-50");
  const box = await overlay.boundingBox();
  // "Справжня" fixed-модалка розтягнута на весь вьюпорт (inset-0) незалежно від скролу
  // сторінки — допуск невеликий (напр. можливий скролбар), але до бага верхній край
  // потрапляв на сотні пікселів нижче (там, де випадково зупинявся скрол сторінки).
  expect(box?.x).toBeLessThan(20);
  expect(box?.y).toBeLessThan(20);

  await page.getByRole("button", { name: "Закрити", exact: true }).click();
  await expect(modalHeading).not.toBeVisible();
});
