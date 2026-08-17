import { test, expect } from "./fixtures";
import { addVacancy, detailDialog } from "./helpers";

/**
 * The vacancy detail modal's "next action" field (vacancy-detail-modal.tsx) — a freeform text
 * companion to the "Next step" date ("Next step: 15.08.2026" doesn't say what to actually DO
 * about it). Offers common phrasings via a native <datalist> (id="next-action-suggestions") while
 * staying fully freeform — typing anything else is never blocked. Draft-committed like notes, not
 * immediate like the date itself, so it only lands on the server via the footer's Save.
 */

test("the next-action field offers datalist suggestions, accepts freeform text, and persists across reload", async ({ page }) => {
  await page.goto("/vacancies");
  const created = await addVacancy(page, { company: "Datalist Co", position: "Backend Engineer", closeDetail: false });

  const dialog = detailDialog(page);
  const nextActionInput = dialog.getByLabel(`Next action — ${created.company}`);
  await expect(nextActionInput).toBeVisible();

  // The <datalist> exists and is wired to the input via the "list" attribute — this is what
  // actually renders the suggestions in a real browser's autocomplete UI, which Playwright's DOM
  // queries can't drive directly, so this proves the wiring rather than a dropdown click.
  const listId = await nextActionInput.getAttribute("list");
  expect(listId).toBe("next-action-suggestions");
  const datalist = page.locator(`datalist#${listId}`);
  await expect(datalist).toBeAttached();
  const options = await datalist.locator("option").evaluateAll((els) => els.map((e) => e.getAttribute("value")));
  expect(options).toContain("Follow up");
  expect(options.length).toBeGreaterThan(1);

  // Still fully freeform — typing something NOT in the suggestion list is never blocked.
  await nextActionInput.fill("Ping recruiter about the take-home deadline");
  await expect(dialog.getByText("Unsaved changes")).toBeVisible();

  const [savePut] = await Promise.all([
    page.waitForResponse(
      async (r) =>
        /\/api\/vacancies\/\d+$/.test(r.url()) &&
        r.request().method() === "PUT" &&
        (await r.json().catch(() => null))?.nextAction === "Ping recruiter about the take-home deadline",
    ),
    dialog.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(savePut.ok()).toBeTruthy();
  await expect(dialog).not.toBeVisible();

  await page.reload();
  await page
    .getByRole("button", { name: `Open details for Backend Engineer at ${created.company}` })
    .first()
    .click();
  const reopened = detailDialog(page);
  await expect(reopened.getByLabel(`Next action — ${created.company}`)).toHaveValue("Ping recruiter about the take-home deadline");
});
