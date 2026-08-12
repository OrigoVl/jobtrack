import { test, expect } from "./fixtures";

/**
 * End-to-end test of the dashboard's "system-design interview coming up" suggestion
 * (client/src/shared/design-reminders.ts + dashboard.tsx) — a calendar event that looks like a
 * system-design interview, within the lookahead window, surfaces a card whose CTA navigates
 * straight to the Practice page's Architecture tab (not just Practice in general).
 */
test("a matching upcoming calendar event surfaces a dashboard card that deep-links to the Architecture tab", async ({ page }) => {
  const startAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const createRes = await page.request.post("/api/calendar/events", {
    data: { title: "System design interview — E2E Corp", notes: "", startAt, endAt: null, type: "interview", vacancyId: null },
  });
  expect(createRes.ok()).toBeTruthy();

  await page.goto("/dashboard");
  await expect(page.getByText("System-design interview coming up")).toBeVisible();

  await page.getByRole("button", { name: "Practice now" }).click();
  await expect(page).toHaveURL(/\/study$/);
  // The Practice mode switcher is the shared `Segmented` control (shared/ui.tsx), whose selected
  // option is marked `bg-surface text-signal` — not the `bg-star` of the hand-rolled Btn row it
  // replaced.
  await expect(page.getByRole("button", { name: "Architecture", exact: true })).toHaveClass(/text-signal/);
});
