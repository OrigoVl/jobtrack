import { test, expect } from "@playwright/test";

/**
 * The day this test ticked, so it can be unticked again — same reasoning as projects.spec.ts:
 * progress persists in `user_kv` on the shared e2e account, so leaving it set makes the "starts
 * unticked" assertion below true only on a fresh database.
 */
let tickedDayId: string | null = null;

test.afterEach(async ({ page }) => {
  if (!tickedDayId) return;
  await page.request.put("/api/plan21/progress", { data: { dayId: tickedDayId, done: false } });
  tickedDayId = null;
});

/**
 * End-to-end test of a key flow: marking a day in the intensive plan as done
 * (features/plan21/plan21.tsx -> PUT /api/plan21/progress) and persisting progress on the
 * backend — we check that the checkbox stays checked after reloading the page.
 *
 * /plan21 is no longer a page of its own: it's the Roadmap's "Intensive" view, and the old URL
 * redirects there with that view selected (app/App.tsx's RoadmapViewRedirect). The reload below
 * therefore also covers the reason `roadmap-view.ts` persists the choice — without that, a
 * refresh would drop the user back on the skill list and this spec would find no checkbox.
 */
test("marks a plan21 day as done and persists it across reload", async ({ page }) => {
  await page.goto("/plan21");
  await expect(page).toHaveURL(/\/roadmap$/);

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
  tickedDayId = (response.request().postDataJSON() as { dayId: string }).dayId;
  await expect(checkbox).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
});
