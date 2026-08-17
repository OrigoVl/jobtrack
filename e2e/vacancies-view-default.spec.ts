import { test, expect } from "./fixtures";
import { addVacancy } from "./helpers";

/**
 * Vacancies' Table/Kanban default (vacancies.tsx's readStoredView) — a first-ever visit (nothing
 * in localStorage's "jobtrack.vacancies.view" yet) defaults to Kanban on a narrow (<1024px)
 * screen instead of Table: Table's Fit/Salary/Status/Next-step columns scroll off-screen on a
 * phone with no visual hint they exist, while Kanban is already swipeable and puts status/fit
 * right on the card. Any EXPLICIT choice (either direction) is remembered in localStorage and
 * always wins after that, even across a later viewport-size change.
 *
 * Each test clears the storage key itself before asserting the "first-ever visit" default —
 * relying on a truly-fresh browser context isn't safe here since every spec in this suite reuses
 * the same storageState snapshot (playwright.config.ts), and this key is a plain client-only
 * localStorage entry, not something fixtures.ts's row-diffing cleans up. A vacancy is also seeded
 * first: with zero vacancies, vacancies.tsx renders ONE shared "No vacancies yet" empty state for
 * BOTH view modes (neither a <table> nor a Kanban column list exists yet), so the two views are
 * indistinguishable until there's at least one row to actually render differently.
 */

test("a first-ever visit on a narrow (phone-width) screen defaults to Kanban, not Table", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto("/vacancies");
  await addVacancy(page, { company: "ViewDefault Narrow Co", position: "Engineer" });
  await page.evaluate(() => localStorage.removeItem("jobtrack.vacancies.view"));
  await page.reload();

  await expect(page.getByRole("table")).not.toBeVisible();
  await expect(page.getByRole("list", { name: /Want to apply/ })).toBeVisible();
});

test("a first-ever visit on a desktop-width screen defaults to Table, not Kanban", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/vacancies");
  await addVacancy(page, { company: "ViewDefault Desktop Co", position: "Engineer" });
  await page.evaluate(() => localStorage.removeItem("jobtrack.vacancies.view"));
  await page.reload();

  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("list", { name: /Want to apply/ })).not.toBeVisible();
});

test("an explicit Table choice on desktop is remembered even after resizing down to phone width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/vacancies");
  await addVacancy(page, { company: "ViewDefault Sticky Co", position: "Engineer" });
  await page.evaluate(() => localStorage.removeItem("jobtrack.vacancies.view"));
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();

  // Force the OTHER default's starting point (Kanban is desktop's non-default), then switch back
  // explicitly, to prove this is a stored choice and not just "still the desktop default".
  await page.getByRole("button", { name: "Kanban" }).click();
  await expect(page.getByRole("list", { name: /Want to apply/ })).toBeVisible();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();

  await page.setViewportSize({ width: 480, height: 800 });
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("list", { name: /Want to apply/ })).not.toBeVisible();
});
