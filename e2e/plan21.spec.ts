import { test, expect } from "@playwright/test";

/**
 * End-to-end test of a key flow: marking a day in the 21-day intensive as done
 * (features/plan21/plan21.tsx -> POST /api/plan21/day) and persisting progress on the backend —
 * we check that the checkbox stays checked after reloading the page.
 */
test("marks a plan21 day as done and persists it across reload", async ({ page }) => {
  await page.goto("/plan21");

  const checkbox = page.getByRole("checkbox").first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  // The mutation is optimistic (the UI updates instantly, before the server responds) — we
  // wait for the actual network response to PUT /api/plan21/progress, otherwise the reload()
  // below could interrupt a request that hasn't finished yet, and the server would never save
  // the change (a flaky test).
  // .click() instead of .check(): the checkbox is controlled by a React `checked` prop (not
  // native state), so .check()'s built-in "did the state actually change" assertion could catch
  // a frame before the optimistic update reaches the prop — the expect().toBeChecked() below
  // retries on its own until the actual result lands.
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/plan21/progress") && res.request().method() === "PUT"),
    checkbox.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});
