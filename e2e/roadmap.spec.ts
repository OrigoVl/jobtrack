import { test, expect } from "@playwright/test";

/**
 * End-to-end test of a key flow: clicking a skill's status circle in the Roadmap cyclically
 * changes its status (not started → learning → know it → not started) and persists it on the
 * backend (features/roadmap/roadmap.tsx -> POST /api/roadmap/status).
 *
 * We key on a SPECIFIC skill by name (not the "first" node by position): node order within a
 * group is sorted by demand, which can change between steps of this test because other E2E
 * specs concurrently add vacancies (a shared DB across all tests in the run) — a positional
 * locator would be unstable after a reload.
 */
test("toggles a roadmap node status and persists it across reload", async ({ page }) => {
  await page.goto("/roadmap");

  const nodeCard = page.locator("div.relative.pl-8").first();
  await expect(nodeCard).toBeVisible();
  const techName = (await nodeCard.locator("span.font-semibold").first().textContent())?.trim() ?? "";
  expect(techName).not.toBe("");

  const statusButton = nodeCard.locator('button[title^="Click to change status"]');
  const before = await statusButton.textContent();
  // The mutation is optimistic (the UI updates instantly, before the server responds) — we
  // wait for the actual network response to PUT /api/roadmap/progress, otherwise the reload()
  // below could interrupt a request that hasn't finished yet, and the server would never save
  // the change (a flaky test).
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/roadmap/progress") && res.request().method() === "PUT"),
    statusButton.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(statusButton).not.toHaveText(before ?? "");
  const after = await statusButton.textContent();

  await page.reload();

  const nodeCardAfterReload = page.locator("div.relative.pl-8").filter({ has: page.getByText(techName, { exact: true }) });
  await expect(nodeCardAfterReload.locator('button[title^="Click to change status"]')).toHaveText(after ?? "");
});
