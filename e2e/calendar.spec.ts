import { test, expect } from "./fixtures";
import { addVacancy } from "./helpers";

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
  // selected day), so the new event shows up without navigating: once inside today's grid cell,
  // once in the "Upcoming" card below. Hence `.first()` on every by-text assertion here — the
  // title is deliberately rendered in both places.
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Type").selectOption("interview");

  const [createRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/calendar/events") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { id: number };

  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  // Persistence — reload the real page and confirm the event survived, not just an optimistic
  // client-side update.
  await page.reload();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  // Edit — change the title via the same modal, opened from the Upcoming row (labelled
  // "Edit <title>", like the day popover's own edit action).
  await page
    .getByRole("button", { name: `Edit ${title}` })
    .first()
    .click();
  const titleInput = page.getByLabel("Title");
  await titleInput.fill(editedTitle);
  const [updateRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/calendar/events/${created.id}`) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(updateRes.ok()).toBeTruthy();
  await expect(page.getByText(editedTitle, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  // Delete — from inside the edit modal, whose Delete opens the shared confirm dialog
  // (shared/confirm.tsx) before the mutation actually fires.
  await page
    .getByRole("button", { name: `Edit ${editedTitle}` })
    .first()
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
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

  // addVacancy() also dismisses the detail modal the save opens, which the rest of this test needs
  // gone: it carries its own "Next step date" field with the same aria-label as the table's.
  // A unique company name per run, because the row is then addressed BY that name ("Next step
  // date — <company>") — a fixed one silently becomes ambiguous the moment a leftover row from an
  // interrupted run is still in this shared, only-reset-per-suite database.
  const vacancy = await addVacancy(page, { company: `Calendar Corp ${Date.now()}`, position: "Next Step Engineer" });

  await page.getByLabel(`Next step date — ${vacancy.company}`).fill(todayDisplay);
  await page.waitForResponse((r) => r.url().includes(`/api/vacancies/${vacancy.id}`) && r.request().method() === "PUT");

  await page.goto("/calendar");
  // The next-step marker is listed in the "Upcoming" card (it used to be in a selected-day card
  // below the grid); the same row also exists inside that day's popover, but this one is visible
  // without opening anything.
  const nextStepButton = page.getByRole("button", { name: new RegExp(`${vacancy.company}.*Next step`) });
  await expect(nextStepButton).toBeVisible();
  await nextStepButton.click();
  // Client-side (React Router) navigation, not a full page load — assert on the destination
  // page's own content rather than page.waitForURL's "load" lifecycle event, which an SPA
  // route change never (re-)fires.
  await expect(page.getByRole("heading", { name: "Vacancies" })).toBeVisible();
  expect(page.url()).toContain("/vacancies");
});

/**
 * The Month/Week/List switcher and the per-event export actions (features/calendar/
 * calendar-export.ts). The export assertions are on the Google Calendar link's href rather than a
 * download: the .ics is built in the browser from a Blob, so there's nothing to intercept, and the
 * string building itself is unit-tested in calendar-export.test.ts.
 */
test("switches between month, week and list views, and offers an event for export", async ({ page }) => {
  await page.goto("/calendar");

  const title = `E2E View Switch ${Date.now()}`;
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByLabel("Title").fill(title);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/calendar/events") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);

  // Week: the period label narrows from a month name to a date range (whose exact shape is
  // Intl.formatRange's call, per locale — assert on the range dash + year, not on a layout).
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(page.getByText(/\d{1,2} – .*\d{4}/)).toBeVisible();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  // List: a flat agenda of the visible month, no grid.
  await page.getByRole("button", { name: "List", exact: true }).click();
  const row = page.getByRole("button", { name: `Edit ${title}` });
  await expect(row).toBeVisible();

  // Export — offered from the event's own modal, prefilled from what the form currently holds.
  await row.click();
  await expect(page.getByRole("button", { name: /\.ics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Google Calendar" })).toHaveAttribute(
    "href",
    /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/,
  );

  // Clean up so this spec doesn't leave a row behind for the shared e2e account.
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/calendar/events/") && r.request().method() === "DELETE"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
});

/**
 * The per-event video-call link (features/calendar/meeting-link.ts + join-call-link.tsx): typed
 * once in the modal, then joinable in one click from the agenda row — and carried into the Google
 * Calendar export as `location`, which is what makes it a join button in Google's own UI.
 *
 * The scheme-less form is used on purpose: it's what Meet/Zoom print in their own UI and what
 * therefore gets pasted, and normalizing it is the difference between a saved link and a 400.
 */
test("saves a scheme-less call link, offers it as a join link, and exports it", async ({ page }) => {
  await page.goto("/calendar");

  const title = `E2E Call Link ${Date.now()}`;
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Call link (optional)").fill("meet.google.com/jxs-ewjz-onf");

  // The preview inside the modal proves the value parsed before anything is saved.
  const joinInModal = page.getByRole("dialog").getByRole("link", { name: /Join the call on Google Meet/ });
  await expect(joinInModal).toHaveAttribute("href", "https://meet.google.com/jxs-ewjz-onf");

  // Google Calendar export carries the normalized link, not the raw typed one.
  await expect(page.getByRole("link", { name: "Google Calendar" })).toHaveAttribute(
    "href",
    /location=https%3A%2F%2Fmeet\.google\.com%2Fjxs-ewjz-onf/,
  );

  const [createRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/calendar/events") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { id: number; meetingUrl: string };
  // Stored in its own column, normalized — not left as free text in `notes`.
  expect(created.meetingUrl).toBe("https://meet.google.com/jxs-ewjz-onf");

  // Joinable straight from the Upcoming row, without opening the event first — and it survives a
  // real reload, so this is the persisted row rather than an optimistic cache entry.
  await page.reload();
  await expect(page.getByRole("link", { name: /Join the call on Google Meet/ }).first()).toHaveAttribute(
    "href",
    "https://meet.google.com/jxs-ewjz-onf",
  );

  // Clean up so this spec doesn't leave a row behind for the shared e2e account.
  await page
    .getByRole("button", { name: `Edit ${title}` })
    .first()
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/calendar/events/${created.id}`) && r.request().method() === "DELETE"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
});
