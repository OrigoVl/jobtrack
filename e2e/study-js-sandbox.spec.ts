import { test, expect } from "@playwright/test";

/**
 * "🧪 Пісочниця JS" (features/study/runner.ts) виконує довільний код у Web Worker (не на
 * головному потоці, як було раніше) — реальний браузерний шлях виконання перевіряємо тут.
 * Таймаут/убивство нескінченного циклу (найважливіша частина контракту) перевіряється ОКРЕМО
 * юніт-тестом із фейковими таймерами й мок-Worker (src/features/study/runner.test.ts) — реальний
 * busy-loop у справжньому Worker перевантажує CPU настільки, що в CI/sandboxed середовищах з
 * малою к-стю ядер підвисає навіть click() ще ДО старту циклу (конкуренція за той самий процес
 * Chromium), що робить такий e2e-тест недетермінованим залежно від заліза раннера.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/study");
  await page.getByRole("button", { name: "⌨️ Drill" }).click();
  // Статичні drill-задачі категорії "JavaScript" мають запускний блок пісочниці (RUNNABLE_CATS).
  await page.locator("select").first().selectOption("JavaScript");
  await page.getByRole("button", { name: /Відкрити пісочницю/ }).click();
});

test("runs normal code in a real Worker (not eval on the main thread) and shows console.log output", async ({ page }) => {
  const textarea = page.locator("textarea");
  await textarea.fill("console.log(1 + 1);");
  await page.getByRole("button", { name: "▶ Запустити" }).click();
  await expect(page.getByText("2", { exact: true })).toBeVisible();
});

test("surfaces a runtime error from the sandboxed code without crashing the page", async ({ page }) => {
  const textarea = page.locator("textarea");
  await textarea.fill("throw new Error('boom');");
  await page.getByRole("button", { name: "▶ Запустити" }).click();
  await expect(page.getByText(/Error: boom/)).toBeVisible();
  // Сторінка лишається живою й керованою після помилки в пісочниці.
  await expect(page.getByRole("button", { name: "Скинути" })).toBeEnabled();
});
