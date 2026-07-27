import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест ключового флоу: додавання вакансії + клавіатурне переміщення картки
 * в Kanban-режимі (альтернатива drag-and-drop, критична для доступності — див. vacancies.tsx).
 */
test("adds a vacancy and moves its card via keyboard in Kanban view", async ({ page }) => {
  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Додати вакансію" }).click();

  // Перемикаємось на Kanban-режим, де живе клавіатурна навігація.
  await page.getByRole("button", { name: "🗂 Канбан" }).click();

  const card = page.getByRole("button", { name: /Нова компанія, Позиція\. Статус: Хочу подати\./ }).first();
  await expect(card).toBeVisible();

  await card.focus();
  await page.keyboard.press("ArrowRight");

  // Після переміщення картка повинна опинитись у наступній колонці зі статусом
  // "Відправив CV" (наступний елемент масиву STATUSES) — і фокус лишається на ній.
  const movedCard = page.getByRole("button", { name: /Нова компанія, Позиція\. Статус: Відправив CV\./ }).first();
  await expect(movedCard).toBeVisible();
  await expect(movedCard).toBeFocused();
});
