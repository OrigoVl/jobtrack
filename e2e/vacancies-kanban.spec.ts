import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the key flow: adding a vacancy + moving its card via keyboard
 * in Kanban view (an alternative to drag-and-drop, critical for accessibility — see vacancies.tsx).
 */
test("adds a vacancy and moves its card via keyboard in Kanban view", async ({ page }) => {
  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  // "+ Add vacancy" now opens the detail modal for filling it in right away — close it to reach
  // the Kanban toggle underneath (see vacancy-detail-modal.tsx). Waiting for it to actually be
  // visible first matters: it opens from the add-mutation's success callback, a render cycle
  // after the click itself resolves, so it isn't necessarily on-screen the instant the click does.
  const addDialog = page.getByRole("dialog");
  await expect(addDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addDialog).not.toBeVisible();

  // Switch to Kanban view, where keyboard navigation lives.
  await page.getByRole("button", { name: "Kanban" }).click();

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
