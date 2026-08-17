import { test, expect } from "@playwright/test";

/**
 * The Account page (account.tsx) is entirely settings toggles/exports — no rows to create/clean
 * up via ./fixtures, so this uses @playwright/test directly like i18n-language-switch.spec.ts.
 *
 * The sidebar (App.tsx) ALSO renders its own ThemeSwitcher/LanguageSwitcher — both are visible at
 * once at desktop width, so every locator here is scoped to `getByRole("main")` to avoid a
 * strict-mode double-match with the sidebar's copy.
 */

test("the theme switcher updates <html data-theme> and persists across a reload", async ({ page }) => {
  await page.goto("/account");
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Leave it as found for whoever reuses this browser context next.
  await main.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the weekly digest toggle persists across a reload", async ({ page }) => {
  const before = await (await page.request.get("/api/digest/preferences")).json();

  await page.goto("/account");
  const main = page.getByRole("main");
  const digestToggle = main.getByRole("checkbox", { name: "Send me the weekly digest" });
  await expect(digestToggle).toHaveJSProperty("checked", before.enabled);

  // A plain click, not setChecked(): the checkbox is controlled off the query cache and only
  // flips once the PUT resolves and refills it (no optimistic update), so setChecked's "did the
  // native checkbox toggle immediately" stability check never settles.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/digest/preferences") && r.request().method() === "PUT"),
    digestToggle.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(digestToggle).toHaveJSProperty("checked", !before.enabled);

  await page.reload();
  await expect(main.getByRole("checkbox", { name: "Send me the weekly digest" })).toHaveJSProperty("checked", !before.enabled);

  // Real server-side preference on the shared e2e account — restore it rather than leaving the
  // next run's account in a flipped state.
  await page.request.put("/api/digest/preferences", { data: { enabled: before.enabled } });
});

test("exporting data downloads a JSON file with everything in it", async ({ page }) => {
  await page.goto("/account");
  const main = page.getByRole("main");

  const [download] = await Promise.all([page.waitForEvent("download"), main.getByRole("button", { name: "Export my data" }).click()]);
  expect(download.suggestedFilename()).toBe("devradar-export.json");
});
