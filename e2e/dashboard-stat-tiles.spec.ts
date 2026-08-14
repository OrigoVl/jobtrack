import { test, expect } from "./fixtures";

/**
 * The dashboard's stat-tile row (dashboard.tsx's StatTile) — used to be five tiles in one row with
 * vacancy stats (Total vacancies/Active/In interviews) mixed in next to learning stats (Cards
 * learned/Day streak), and none of them were clickable. Now split into two groups — vacancy stats
 * navigate to /vacancies, learning stats get their own "Learning" heading and navigate to /study —
 * and every tile is a real button.
 */

test("the vacancy stat tiles (Total vacancies, Active, In interviews) navigate to /vacancies", async ({ page }) => {
  await page.goto("/dashboard");

  for (const label of ["Total vacancies", "Active", "In interviews"]) {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await expect(page).toHaveURL(/\/vacancies$/);
  }
});

test("the learning stat tiles (Cards learned, Day streak) sit under their own heading and navigate to /study", async ({ page }) => {
  await page.goto("/dashboard");

  // Structurally separate from the vacancy stats above it — not just two more tiles in the same row.
  await expect(page.getByText("Learning", { exact: true })).toBeVisible();

  for (const label of ["Cards learned", "Day streak"]) {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await expect(page).toHaveURL(/\/study$/);
  }
});
