import { test, expect } from "./fixtures";

/**
 * The create modal's Tech stack field auto-hides for a position that plainly isn't technical
 * (tracks.ts's looksNonTechnical — a narrow client mirror of the server's track-signal regexes:
 * PM/QA/Design). Per explicit product decision: an irrelevant empty field shouldn't take up room
 * on, say, a Product Manager vacancy. A manual "+ Add tech stack anyway" link always wins, so a
 * heuristic miss never actually blocks anyone from adding a stack — see
 * client/src/shared/tracks.ts and vacancy-create-modal.tsx.
 */

test("Tech stack hides for a non-technical position, and '+ Add tech stack anyway' always wins", async ({ page }) => {
  await page.goto("/vacancies");
  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const positionInput = dialog.getByLabel("Position", { exact: true });
  const stackInput = dialog.getByPlaceholder("Add a technology…");
  const showAnywayLink = dialog.getByRole("button", { name: "+ Add tech stack anyway" });

  // A technical position: the Tech stack input is there from the start.
  await positionInput.fill("Senior Backend Engineer");
  await expect(stackInput).toBeVisible();
  await expect(showAnywayLink).not.toBeVisible();

  // Editing the position into a plainly non-technical one hides the field again — this reruns on
  // every keystroke, not just once at mount.
  await positionInput.fill("Product Manager");
  await expect(stackInput).not.toBeVisible();
  await expect(showAnywayLink).toBeVisible();

  // The manual override always wins: clicking it reveals the field even though the position is
  // still non-technical, and it never hides itself again just because a later edit re-triggers
  // the heuristic.
  await showAnywayLink.click();
  await expect(stackInput).toBeVisible();
  await expect(showAnywayLink).not.toBeVisible();
  await positionInput.fill("QA Engineer");
  await expect(stackInput).toBeVisible();
});

test("Tech stack never hides once it already has entries, even after editing the position to a non-technical title", async ({ page }) => {
  await page.goto("/vacancies");
  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const positionInput = dialog.getByLabel("Position", { exact: true });
  // SkillsInput (view-kit.tsx) switches its own placeholder from "Add a technology…" to
  // "Search skill…" the moment it has at least one entry — unrelated to this feature, so the
  // locator has to match either, not just the empty-state text this spec's first test used.
  const stackInput = dialog.getByPlaceholder(/Add a technology…|Search skill…/);

  await positionInput.fill("Software Engineer");
  await stackInput.fill("Go");
  await stackInput.press("Enter");
  await expect(dialog.getByText("Go")).toBeVisible();

  // Now edit the position into something the heuristic reads as non-technical (e.g. after
  // autofill or a change of mind) — the field must stay visible since it isn't empty.
  await positionInput.fill("Scrum Master");
  await expect(stackInput).toBeVisible();
  await expect(dialog.getByText("Go")).toBeVisible();
});
