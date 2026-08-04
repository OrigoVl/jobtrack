import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the language switcher (client/src/shared/language-switcher.tsx): switching
 * to Ukrainian translates the UI immediately (no page reload — react-i18next re-renders every
 * mounted consumer), updates `<html lang>`, and the choice survives a real reload (persisted to
 * localStorage, see client/src/i18n/index.ts). Runs against the production build like every
 * other e2e spec, so this also proves the translated namespace JSON files actually made it into
 * client/dist, not just that they exist in source.
 */
test("switches the UI language, updates <html lang>, and persists the choice across a reload", async ({ page }) => {
  await page.goto("/dashboard");

  // The nav link's accessible name includes its emoji icon ("🏠 Dashboard") — matched by
  // substring, not `exact`, so the icon doesn't have to be repeated in this test.
  const dashboardNavLink = page.getByRole("link", { name: "Dashboard" });
  const dashboardNavLinkUk = page.getByRole("link", { name: "Дашборд" });
  await expect(dashboardNavLink).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "UK", exact: true }).click();

  await expect(dashboardNavLinkUk).toBeVisible();
  await expect(dashboardNavLink).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");

  await page.reload();

  await expect(dashboardNavLinkUk).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");

  // Switch back to English so this test doesn't leave the app in a non-default language for
  // anyone who happens to reuse this browser context afterward.
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(dashboardNavLink).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
