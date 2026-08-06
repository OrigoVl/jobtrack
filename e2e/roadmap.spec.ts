import { test, expect } from "@playwright/test";

// The roadmap's node set is profile.skills ∪ demand-from-tracked-vacancies (see
// server/src/modules/roadmap/roadmap.service.ts#buildRoadmap) — the shared e2e user's profile
// starts with zero skills (db/seed-vacancies.ts's EMPTY_PROFILE, wired into real registration),
// so without a tracked vacancy with a stack, `/roadmap` renders zero nodes and every test below
// would fail on its very first locator. Seeded once per test rather than relying on some OTHER
// spec (alphabetically earlier, sharing this DB) to have added stack data first — that ordering
// dependency is exactly the kind of flakiness a self-contained test should not have.
test.beforeEach(async ({ page }) => {
  await page.request.post("/api/vacancies", {
    data: { company: "E2E Roadmap Seed", position: "Seed", stack: ["React", "TypeScript", "Docker"] },
  });
});

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

/**
 * End-to-end test of the manual skill-level override: expanding a node reveals a "Your level"
 * slider (computed from status/drills/flashcard recall by default, see server's skill-level.ts);
 * dragging it and saving persists a manual override (PUT /api/roadmap/level) that survives a
 * reload and flips the level chip from "Computed" to "Set by you".
 */
test("sets a manual skill level override and persists it across reload", async ({ page }) => {
  await page.goto("/roadmap");

  const nodeCard = page.locator("div.relative.pl-8").first();
  await expect(nodeCard).toBeVisible();
  const techName = (await nodeCard.locator("span.font-semibold").first().textContent())?.trim() ?? "";
  expect(techName).not.toBe("");

  // Row toggle is the second button in the node (the first is the status circle).
  await nodeCard.locator("button").nth(1).click();

  const slider = nodeCard.getByRole("slider");
  await expect(slider).toBeVisible();
  await slider.fill("90");

  const saveButton = nodeCard.getByRole("button", { name: "Save" });
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/roadmap/level") && res.request().method() === "PUT"),
    saveButton.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(nodeCard.getByText("Set by you")).toBeVisible();

  await page.reload();

  const nodeCardAfterReload = page.locator("div.relative.pl-8").filter({ has: page.getByText(techName, { exact: true }) });
  await expect(nodeCardAfterReload.getByText("90/100")).toBeVisible();
  await nodeCardAfterReload.locator("button").nth(1).click();
  await expect(nodeCardAfterReload.getByText("Set by you")).toBeVisible();
});

test("the Radar view renders a chart once at least a few in-demand skills exist", async ({ page }) => {
  // The radar needs at least RADAR_MIN_AXES (3) techs with demand > 0 (see
  // features/roadmap/radar-data.ts) — a fresh account otherwise shows the "no data" empty state
  // instead of a chart. Seeding the stack via a direct API PUT (rather than driving the tech-stack
  // chip-input widget through the UI) keeps this test about the radar, not about that widget.
  await page.goto("/vacancies");
  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  const created: { id: number } = await addResponse.json();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  const putResponse = await page.request.put(`/api/vacancies/${created.id}`, {
    data: { stack: ["React", "TypeScript", "Docker"] },
  });
  expect(putResponse.ok()).toBeTruthy();

  await page.goto("/roadmap");
  await page.getByRole("button", { name: "Radar" }).click();
  await expect(page.locator("svg").first()).toBeVisible();
});
