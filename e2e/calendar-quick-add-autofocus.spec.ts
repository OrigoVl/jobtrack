import { test, expect } from "./fixtures";

/**
 * A day cell's popover (day-agenda.tsx) has a one-field "quick add" for events, separate from the
 * full "+ Add event" modal. It used to take three actions to use (click the day, click into the
 * field, then type) — now the field is focused automatically the moment the popover opens
 * (day-agenda.tsx remounts fresh per day, so a mount-time `useEffect` focus is enough — no
 * `autoFocus` prop, which is project-banned, see the component's own comment), so clicking a day
 * and just typing is the whole flow.
 */

test("clicking a day cell focuses its quick-add field automatically, and Enter creates the event", async ({ page }) => {
  await page.goto("/calendar");

  await page.locator('[aria-current="date"]').click();
  const popover = page.locator("[data-keep-open]");
  const quickAdd = popover.getByPlaceholder("Quick add an event…");
  await expect(quickAdd).toBeFocused();

  const title = "E2E Quick-add Autofocus Check";
  await quickAdd.fill(title);

  const [createRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/calendar/events") && r.request().method() === "POST"),
    quickAdd.press("Enter"),
  ]);
  expect(createRes.ok()).toBeTruthy();
  await expect(popover.getByText(title, { exact: true })).toBeVisible();
});
