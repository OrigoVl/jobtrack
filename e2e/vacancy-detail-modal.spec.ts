import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the vacancy detail modal (features/vacancies/vacancy-detail-modal.tsx) — the
 * "Jira issue"-style hub for one vacancy: every field editable in one place, plus cover-letter
 * generation and CV-fit analysis scoped to that vacancy instead of scattered across the CV and CV
 * Builder pages. "+ Add vacancy" opens it immediately so a new vacancy is filled in through the
 * popup rather than the table's cramped inline inputs (vacancies.tsx).
 *
 * getByLabel(..., { exact: true }) throughout: Playwright's accessible-name match is a substring
 * match by default, and several of this modal's aria-labels legitimately contain "New company"
 * (Salary/Applied date/Next step date/Vacancy link — {{company}}), which would otherwise also
 * match a plain getByLabel("Company").
 */
test("adding a vacancy opens its detail modal, and cover letter + fit analysis both work", async ({ page }) => {
  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Position");
  await expect(dialog.getByLabel("Company", { exact: true })).toHaveValue("New company");

  // Cover letter tab — LLM offline in e2e (see playwright.config.ts), so the response is the
  // deterministic offline template (writing.routes.ts).
  await dialog.getByRole("button", { name: "Cover letter" }).click();
  await dialog.getByRole("button", { name: "Generate letter" }).click();
  await expect(dialog.getByText(/Hello!/)).toBeVisible();

  // Fit tab — a freshly registered account already has a seeded, non-empty CV
  // (server/src/db/seed-vacancies.ts's DEFAULT_PROFILE), so the button is enabled; the offline
  // fallback (server/src/modules/cv/cv-analysis.service.ts's heuristicMatch) is deterministic too.
  await dialog.getByRole("button", { name: "Fit" }).click();
  await dialog.getByRole("button", { name: "Analyze fit" }).click();
  await expect(dialog.getByText(/Basic offline keyword-based comparison/)).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible();
});

test("edits every field from the detail modal, the changes persist across reload, and reopening from the table shows them", async ({
  page,
}) => {
  // Every field here commits independently (its own onBlur/onChange → PUT /vacancies/:id, same
  // as the table), and each PUT's response replaces the ENTIRE cached vacancy wholesale (see
  // useUpdateVacancy in shared/queries/vacancies.ts). Firing several edits in quick succession —
  // exactly what this test does, faster than a real typing user — means several such PUTs can be
  // in flight at once; if a slower one (built from an OLDER snapshot of the row) resolves AFTER a
  // faster one, it silently overwrites the newer field with stale data. So each step below waits
  // for a PUT response whose BODY actually reflects that step's own committed value, not just
  // "any PUT" (which — confirmed while writing this test — can resolve on a completely different
  // in-flight request and let the next step proceed before the real one lands).
  const waitForCommit = (matches: (body: Record<string, unknown>) => boolean) =>
    page.waitForResponse(async (r) => {
      if (!/\/api\/vacancies\/\d+$/.test(r.url()) || r.request().method() !== "PUT") return false;
      const body = await r.json().catch(() => null);
      return !!body && matches(body);
    });

  await page.goto("/vacancies");

  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const companyInput = dialog.getByLabel("Company", { exact: true });
  const urlInput = dialog.getByPlaceholder("Vacancy link (from any site) → the stack fills in itself…");
  const skillInput = dialog.getByPlaceholder("Add a technology…");

  await dialog.getByLabel("Position", { exact: true }).fill("Staff Engineer");
  const [positionPut] = await Promise.all([waitForCommit((b) => b.position === "Staff Engineer"), companyInput.focus()]);
  expect(positionPut.ok()).toBeTruthy();

  await companyInput.fill("Acme Corp");
  const [companyPut] = await Promise.all([waitForCommit((b) => b.company === "Acme Corp"), urlInput.focus()]);
  expect(companyPut.ok()).toBeTruthy();

  await urlInput.fill("https://example.com/careers/staff-engineer");
  // Blurring the url field ALSO triggers the server's best-effort stack auto-enrichment for the
  // new url (vacancy-analysis.service.ts's tryAutoEnrichStack — a real fetch of the url, even
  // though example.com won't have anything to extract) — its response still reports stack: [].
  const [urlPut] = await Promise.all([waitForCommit((b) => b.url === "https://example.com/careers/staff-engineer"), skillInput.click()]);
  expect(urlPut.ok()).toBeTruthy();

  // SkillsInput (shared/view-kit.tsx): type + Enter commits a tag immediately (onChange, not onBlur).
  await skillInput.fill("Kubernetes");
  const [stackPut] = await Promise.all([
    waitForCommit((b) => Array.isArray(b.stack) && b.stack.includes("Kubernetes")),
    skillInput.press("Enter"),
  ]);
  expect(stackPut.ok()).toBeTruthy();
  // Not exact: true — the chip's DOM is <span>Kubernetes<button>✕ (remove)</button></span>, so the
  // span's own full text content is "Kubernetes✕", never exactly "Kubernetes" alone.
  await expect(dialog.getByText("Kubernetes")).toBeVisible();

  await dialog.getByRole("button", { name: "Close" }).click();
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
  const reopened = page.getByRole("dialog");
  await expect(reopened.getByLabel("Position", { exact: true })).toHaveValue("Staff Engineer");
  await expect(reopened.getByLabel("Company", { exact: true })).toHaveValue("Acme Corp");
});

test("opens the same detail modal from a Kanban card", async ({ page }) => {
  await page.goto("/vacancies");
  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  // "+ Add vacancy" now opens its own detail modal right away (a real network round-trip, not
  // instant) — wait for it to actually appear before closing it, or Escape fires on an empty
  // page and the modal (opening moments later) is left open, blocking the Kanban toggle below.
  const addDialog = page.getByRole("dialog");
  await expect(addDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addDialog).not.toBeVisible();

  await page.getByRole("button", { name: "Kanban" }).click();

  const card = page.getByRole("button", { name: /New company, Position\. Status: Want to apply\./ }).first();
  await expect(card).toBeVisible();
  await card.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Position");
});
