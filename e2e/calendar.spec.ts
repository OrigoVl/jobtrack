import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the unified Calendar feature (server/src/modules/calendar/, client
 * features/calendar/calendar.tsx): create/edit/delete a manual event, each step confirmed via
 * the real mutation's response (not a mocked backend, per this suite's convention — see
 * playwright.config.ts), and persistence checked across a real page reload.
 */
test("creates, edits, and deletes a manual calendar event, persisting across reload", async ({ page }) => {
  await page.goto("/calendar");

  const title = "E2E Interview — Acme Corp";
  const editedTitle = "E2E Interview — Acme Corp (rescheduled)";

  // Create — the header's "+ Add event" opens the modal pre-filled with today (the default
  // selected day), so the new event shows up in the day-detail list below without navigating.
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Type").selectOption("interview");

  const [createRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/calendar/events") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { id: number };

  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // Persistence — reload the real page and confirm the event survived, not just an optimistic
  // client-side update.
  await page.reload();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // Edit — change the title via the same modal, opened from the event row's "Edit" action.
  await page.getByRole("button", { name: `Edit ${title}` }).click();
  const titleInput = page.getByLabel("Title");
  await titleInput.fill(editedTitle);
  const [updateRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/calendar/events/${created.id}`) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(updateRes.ok()).toBeTruthy();
  await expect(page.getByText(editedTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  // Delete — the row's inline "Delete" action opens a shared confirm dialog (shared/confirm.tsx)
  // before the mutation actually fires.
  await page.getByRole("button", { name: `Delete ${editedTitle}` }).click();
  const [deleteRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/calendar/events/${created.id}`) && r.request().method() === "DELETE"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
  expect(deleteRes.ok()).toBeTruthy();
  await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0);

  // Persistence of the delete too.
  await page.reload();
  await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0);
});

test("navigates to Vacancies from a vacancy's next-step marker on the calendar", async ({ page }) => {
  // A vacancy with a `next` date of today shows up as a read-only "next step" marker on today's
  // cell (see calendar.service.ts#buildVacancyNextSteps) — clicking it should navigate to the
  // Vacancies page rather than being a dead end.
  await page.goto("/vacancies");
  // Built from local Y/M/D (not toISOString/UTC) — must match the same "today" the calendar's
  // own local `ymd()` helper computes (see features/calendar/calendar.tsx). vacancies.tsx's
  // "Next step" field is shared/date-input.tsx's locale-independent DateInput — a masked text
  // input, not a native `<input type="date">` — so `.fill()` needs its "mm/dd/yyyy" display
  // format, not ISO "YYYY-MM-DD" (the value DateInput's onChange emits back to the caller).
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const todayDisplay = `${pad2(now.getMonth() + 1)}/${pad2(now.getDate())}/${now.getFullYear()}`;

  const [addRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vacancies") && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  expect(addRes.ok()).toBeTruthy();
  const vacancy = (await addRes.json()) as { id: number; company: string };

  await page.getByLabel(`Next step date — ${vacancy.company}`).fill(todayDisplay);
  await page.waitForResponse((r) => r.url().includes(`/api/vacancies/${vacancy.id}`) && r.request().method() === "PUT");

  await page.goto("/calendar");
  const nextStepButton = page.getByRole("button", { name: /Next step .* → Vacancies/ });
  await expect(nextStepButton).toBeVisible();
  await nextStepButton.click();
  // Client-side (React Router) navigation, not a full page load — assert on the destination
  // page's own content rather than page.waitForURL's "load" lifecycle event, which an SPA
  // route change never (re-)fires.
  await expect(page.getByRole("heading", { name: "Vacancies" })).toBeVisible();
  expect(page.url()).toContain("/vacancies");
});
