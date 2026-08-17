import { test, expect } from "./fixtures";

/**
 * The sidebar's "Roadmap: X/Y" progress widget (App.tsx's SidebarProgress). Used to be a plain
 * <div> — no hover state, no arrow, nothing marking it as a link even though clicking it did
 * nothing. Now a real <button> that navigates to /roadmap, matching the sidebar's other nav items.
 */

test("the sidebar's Roadmap progress widget navigates to /roadmap when clicked", async ({ page }) => {
  await page.goto("/dashboard");

  const widget = page.getByRole("button", { name: /^Roadmap: \d+\/\d+$/ });
  await expect(widget).toBeVisible();
  await widget.click();

  await expect(page).toHaveURL(/\/roadmap$/);
});

test("the widget is reachable and clickable from a page other than the dashboard too", async ({ page }) => {
  await page.goto("/vacancies");

  const widget = page.getByRole("button", { name: /^Roadmap: \d+\/\d+$/ });
  await expect(widget).toBeVisible();
  await widget.click();

  await expect(page).toHaveURL(/\/roadmap$/);
});
