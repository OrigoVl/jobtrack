import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the key flow: adding a vacancy + moving its card via keyboard
 * in Kanban view (an alternative to drag-and-drop, critical for accessibility — see vacancies.tsx).
 */
test("adds a vacancy and moves its card via keyboard in Kanban view", async ({ page }) => {
  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Add vacancy" }).click();

  // Switch to Kanban view, where keyboard navigation lives.
  await page.getByRole("button", { name: "🗂 Kanban" }).click();

  const card = page.getByRole("button", { name: /New company, Position\. Status: Want to apply\./ }).first();
  await expect(card).toBeVisible();

  await card.focus();
  await page.keyboard.press("ArrowRight");

  // After the move, the card should end up in the next column with status
  // "Applied" (the next element in the STATUSES array) — and focus stays on it.
  const movedCard = page.getByRole("button", { name: /New company, Position\. Status: Applied\./ }).first();
  await expect(movedCard).toBeVisible();
  await expect(movedCard).toBeFocused();
});
