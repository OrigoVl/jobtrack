import { test, expect } from "./fixtures";
import { addVacancy, detailDialog } from "./helpers";

/**
 * The SAME Tech-stack-hides-for-a-non-technical-position feature as
 * vacancies-tech-stack-hide.spec.ts, but for the detail modal (vacancy-detail-modal.tsx) — a
 * separate implementation with its own `showStack`/`stackForced` state, not shared code with the
 * create modal, so a regression here wouldn't be caught by that spec.
 */

test("the detail modal hides Tech stack for a non-technical position, and the manual override wins", async ({ page }) => {
  await page.goto("/vacancies");
  await addVacancy(page, { company: "Detail Hide Co", position: "Senior Backend Engineer", closeDetail: false });

  const dialog = detailDialog(page);
  const positionInput = dialog.getByLabel("Position", { exact: true });
  const stackInput = dialog.getByPlaceholder(/Add a technology…|Search skill…/);
  const showAnywayLink = dialog.getByRole("button", { name: "+ Add tech stack anyway" });

  // Technical position (as created): the field is there from the start.
  await expect(stackInput).toBeVisible();
  await expect(showAnywayLink).not.toBeVisible();

  // Editing into a non-technical title hides it again.
  await positionInput.fill("Product Manager");
  await expect(stackInput).not.toBeVisible();
  await expect(showAnywayLink).toBeVisible();

  // Manual override always wins, even on a later edit that re-triggers the heuristic.
  await showAnywayLink.click();
  await expect(stackInput).toBeVisible();
  await positionInput.fill("QA Engineer");
  await expect(stackInput).toBeVisible();
});

test("the detail modal never hides Tech stack once it already has entries", async ({ page }) => {
  await page.goto("/vacancies");
  await addVacancy(page, { company: "Detail Sticky Stack Co", position: "Software Engineer", closeDetail: false });

  const dialog = detailDialog(page);
  const stackInput = dialog.getByPlaceholder(/Add a technology…|Search skill…/);
  await stackInput.fill("Rust");
  await stackInput.press("Enter");
  await expect(dialog.getByText("Rust")).toBeVisible();

  await dialog.getByLabel("Position", { exact: true }).fill("Product Manager");
  await expect(stackInput).toBeVisible();
  await expect(dialog.getByText("Rust")).toBeVisible();
});
