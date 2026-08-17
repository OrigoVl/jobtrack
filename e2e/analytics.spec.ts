import { test, expect } from "./fixtures";
import { addVacancy } from "./helpers";

/**
 * Analytics (features/analytics/charts.tsx) has no dedicated spec yet, despite a real bug fixed
 * this session (the "Technology demand" Y-axis clipping/overlapping long Ukrainian labels — see
 * charts.tsx's demandAxisWidth/demandTick). Seeding the stack via a direct API PUT (not the
 * tech-stack chip-input widget) keeps this about the analytics page, not that widget — same
 * pattern as roadmap.spec.ts's Radar-view test.
 */

test("shows the empty state when the account has no vacancy data yet", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByText("Empty for now", { exact: true })).toBeVisible();
  await expect(page.getByText("Application funnel", { exact: true })).not.toBeVisible();
});

test("renders the funnel and demand charts once a vacancy with a tech stack exists", async ({ page }) => {
  await page.goto("/vacancies");
  const created = await addVacancy(page, { company: "Analytics Chart Co", position: "Platform Engineer" });

  const putResponse = await page.request.put(`/api/vacancies/${created.id}`, {
    data: { stack: ["Zig", "Elixir", "Nim"] },
  });
  expect(putResponse.ok()).toBeTruthy();

  await page.goto("/analytics");

  // The funnel chart plots every vacancy's CURRENT status — a fresh vacancy starts at "Want to
  // apply", so that category's bar carries a real (non-empty-state) label.
  await expect(page.getByText("Want to apply", { exact: true }).first()).toBeVisible();

  // All three seeded techs are obscure enough that they land inside the demand chart's top-12 cap
  // even on a noisier account, and distinctive enough that a match can't be leftover state from
  // another spec.
  for (const tech of ["Zig", "Elixir", "Nim"]) {
    await expect(page.getByText(tech, { exact: true }).first()).toBeVisible();
  }
});
