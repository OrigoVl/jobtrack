import { test, expect } from "@playwright/test";
import { addVacancy, detailDialog } from "./helpers";

/**
 * End-to-end test of the vacancy detail modal (features/vacancies/vacancy-detail-modal.tsx) — the
 * "Jira issue"-style hub for one vacancy: every field editable in one place, plus cover-letter
 * generation and CV-fit analysis scoped to that vacancy instead of scattered across the CV and CV
 * Builder pages. Adding a vacancy goes through the create modal (vacancy-create-modal.tsx) first,
 * which opens this one on its new row.
 *
 * getByLabel(..., { exact: true }) throughout: Playwright's accessible-name match is a substring
 * match by default, and several of this modal's aria-labels legitimately contain "New company"
 * (Salary/Applied date/Next step date/Vacancy link — {{company}}), which would otherwise also
 * match a plain getByLabel("Company").
 *
 * The company is only ever typed in the CREATE modal, which creates and links the company row on
 * Save — the detail modal offers only the "Linked company" select, no free-text company field.
 */

test("adding a vacancy opens its detail modal, and cover letter + fit analysis both work", async ({ page }) => {
  // "Analyze fit" is disabled without a CV, and a freshly registered account gets EMPTY_PROFILE
  // (seed-vacancies.ts — real signups deliberately no longer get the fictional SAMPLE_PROFILE), so
  // the CV text is seeded straight through the API, the same shortcut cv-public-share.spec.ts uses.
  const seedRes = await page.request.put("/api/profile", {
    data: { skills: ["TypeScript", "React"], cvText: "Frontend Developer, 5 years of experience. TypeScript, React, Node.js." },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Company", { exact: true }).fill("New company");
  await createDialog.getByLabel("Position", { exact: true }).fill("Position");
  await createDialog.getByRole("button", { name: "Save" }).click();

  const dialog = detailDialog(page);
  await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Position");
  // The company row was created from the typed name and linked to this vacancy. The picker is a
  // SearchSelect (shared/ui.tsx), so its input value is the company's NAME — the id it actually
  // stores is no longer what a value assertion can see (it was, back when this was a <select>).
  await expect(dialog.getByLabel("Linked company", { exact: true })).toHaveValue("New company");

  // Cover letter tab — LLM offline in e2e (see playwright.config.ts), so the response is the
  // deterministic offline template (writing.routes.ts).
  await dialog.getByRole("button", { name: "Cover letter" }).click();
  await dialog.getByRole("button", { name: "Generate letter" }).click();
  await expect(dialog.getByText(/Hello!/)).toBeVisible();

  // Fit tab — the CV seeded at the top of this test enables the button; the offline fallback
  // (server/src/modules/cv/cv-analysis.service.ts's heuristicMatch) is deterministic too.
  await dialog.getByRole("button", { name: "Fit" }).click();
  await dialog.getByRole("button", { name: "Analyze fit" }).click();
  await expect(dialog.getByText(/Basic offline keyword-based comparison/)).toBeVisible();

  // A generated letter is a draft edit like any other, so Save is what persists it (and closes) —
  // the ✕ would ask whether to throw it away.
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: "Open details for Position at New company" }).first().click();
  await detailDialog(page).getByRole("button", { name: "Cover letter" }).click();
  await expect(detailDialog(page).getByText(/Hello!/)).toBeVisible();
});

test("edits every field from the detail modal, the changes persist across reload, and reopening from the table shows them", async ({
  page,
}) => {
  // Matching the response BODY, not just "a PUT to /vacancies/:id": each PUT's response replaces
  // the ENTIRE cached vacancy wholesale (see useUpdateVacancy in shared/queries/vacancies.ts), and
  // a bare "any PUT" wait can resolve on some other in-flight request and let the next step run
  // before this step's own write has actually landed.
  const waitForCommit = (matches: (body: Record<string, unknown>) => boolean) =>
    page.waitForResponse(async (r) => {
      if (!/\/api\/vacancies\/\d+$/.test(r.url()) || r.request().method() !== "PUT") return false;
      const body = await r.json().catch(() => null);
      return !!body && matches(body);
    });

  await page.goto("/vacancies");

  // Company + position are committed by the create modal's own Save (one POST), not field by
  // field — only what's edited afterwards, inside the detail modal, goes through waitForCommit.
  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Company", { exact: true }).fill("Acme Corp");
  await createDialog.getByLabel("Position", { exact: true }).fill("Staff Engineer");
  await createDialog.getByRole("button", { name: "Save" }).click();

  const dialog = detailDialog(page);
  await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Staff Engineer");
  // Typing the name in the create modal created the company row and linked it — that picker is
  // the detail modal's only company control. It's a SearchSelect (shared/ui.tsx), i.e. a text
  // input showing the selected option's label, not a <select> with a checked <option>.
  await expect(dialog.getByLabel("Linked company")).toHaveValue("Acme Corp");

  const urlInput = dialog.getByPlaceholder("Vacancy link (from any site) → the stack fills in itself…");
  const skillInput = dialog.getByPlaceholder("Add a technology…");

  // Nothing in this modal commits on its own: text, the tech stack (SkillsInput, shared/
  // view-kit.tsx — type + Enter adds a chip locally) and the linked company are all one draft that
  // Save sends as a SINGLE PUT. That PUT also triggers the server's best-effort stack
  // auto-enrichment for the newly set url (vacancy-analysis.service.ts's tryAutoEnrichStack — a
  // real fetch, even though example.com won't have anything to extract).
  await skillInput.fill("Kubernetes");
  await skillInput.press("Enter");
  // Not exact: true — the chip's DOM is <span>Kubernetes<button>✕ (remove)</button></span>, so the
  // span's own full text content is "Kubernetes✕", never exactly "Kubernetes" alone.
  await expect(dialog.getByText("Kubernetes")).toBeVisible();

  await urlInput.fill("https://example.com/careers/staff-engineer");
  await dialog.getByPlaceholder("Anything worth remembering about this vacancy…").fill("Referred by a friend");
  await expect(dialog.getByText("Unsaved changes")).toBeVisible();

  const [savePut] = await Promise.all([
    waitForCommit(
      (b) =>
        b.url === "https://example.com/careers/staff-engineer" &&
        b.notes === "Referred by a friend" &&
        Array.isArray(b.stack) &&
        b.stack.includes("Kubernetes"),
    ),
    dialog.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(savePut.ok()).toBeTruthy();
  await expect(dialog).not.toBeVisible();
  await page.reload();

  // Playwright has no getByDisplayValue (that's a Testing Library API) — an input's persisted
  // value is a "value" attribute, matched with a plain CSS attribute selector instead. .first() —
  // this exact spec run repeatedly against the same shared e2e DB (no per-test reset) can leave
  // more than one "Staff Engineer" row behind; only the "Open details for Staff Engineer at Acme
  // Corp" button check below actually pins down THIS test's own row (unique position+company pair).
  await expect(page.locator('input[value="Staff Engineer"]').first()).toBeVisible();
  await expect(page.locator('input[value="Acme Corp"]').first()).toBeVisible();
  await expect(page.locator('input[value="https://example.com/careers/staff-engineer"]').first()).toBeVisible();
  await expect(page.getByText("Kubernetes").first()).toBeVisible();

  // Reopening from the table's own "open details" button (not just the auto-open-on-add path
  // exercised above) shows the same, now-persisted values.
  await page.getByRole("button", { name: "Open details for Staff Engineer at Acme Corp" }).first().click();
  const reopened = detailDialog(page);
  await expect(reopened.getByLabel("Position", { exact: true })).toHaveValue("Staff Engineer");
  await expect(reopened.getByLabel("Linked company")).toHaveValue("Acme Corp");
});

test("closing the detail modal with an unsaved edit asks first and throws the edit away", async ({ page }) => {
  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Company", { exact: true }).fill("Discard Inc");
  await createDialog.getByLabel("Position", { exact: true }).fill("Original Title");
  await createDialog.getByRole("button", { name: "Save" }).click();

  const dialog = detailDialog(page);
  await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Original Title");

  // No PUT may leave the browser for a draft edit that's never saved — asserted directly, since
  // the reopened value below would also look right if the edit had been saved and then reverted.
  let sawPut = false;
  page.on("request", (r) => {
    if (/\/api\/vacancies\/\d+$/.test(r.url()) && r.method() === "PUT") sawPut = true;
  });

  await dialog.getByLabel("Position", { exact: true }).fill("Typed But Never Saved");
  // Escape rather than the footer's Cancel: same requestClose() path, and this is the one place
  // that keypress is safe to assert on — the "Unsaved changes" assertion above already proves the
  // modal has re-rendered after user input, so its keydown effect is long since registered.
  await expect(dialog.getByText("Unsaved changes")).toBeVisible();
  await page.keyboard.press("Escape");
  // The confirm dialog is role="alertdialog" (shared/confirm.tsx), so it doesn't collide with the
  // modal's own role="dialog" locator above.
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: "Open details for Original Title at Discard Inc" }).first().click();
  await expect(detailDialog(page).getByLabel("Position", { exact: true })).toHaveValue("Original Title");
  expect(sawPut).toBe(false);
});

test("opens the same detail modal from a Kanban card", async ({ page }) => {
  await page.goto("/vacancies");
  // addVacancy() waits for the detail modal the save opens and dismisses it again — leaving it up
  // would cover the Kanban toggle with its backdrop.
  await addVacancy(page, { company: "New company", position: "Position" });

  await page.getByRole("button", { name: "Kanban" }).click();

  const card = page.getByRole("button", { name: /New company, Position\. Status: Want to apply\./ }).first();
  await expect(card).toBeVisible();
  await card.click();

  const dialog = detailDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Position");
});
