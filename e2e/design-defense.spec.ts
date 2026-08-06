import { test, expect } from "@playwright/test";

const FIXTURE_EXERCISE = {
  task: {
    title: "Design a URL shortener",
    scenario: "Design a service that shortens long URLs and redirects visitors to the original one.",
    requirements: ["Handle high read volume", "Custom short codes"],
    constraints: ["Low latency redirects"],
    difficulty: "medium",
  },
  diagram: { nodes: [], edges: [] },
  grade: { offline: true, score: 40, summary: "Basic offline structural check.", criteria: [], strengths: [], missed: [], tip: "" },
};

/**
 * E2E always runs with the LLM offline (see design-trainer.spec.ts) — task generation has no
 * offline heuristic, so a graded exercise can't be produced by driving the real UI. Rather than
 * seeding one via a real POST /design/grade (which would persist to the shared e2e test user's
 * user_kv row and leak into other spec files run in the same suite, e.g. design-trainer.spec.ts's
 * own "no task yet" assertion), this intercepts GET /design/current to serve a fixture exercise
 * client-side only — no backend state is touched. POST /design/defense itself is NOT mocked: it's
 * stateless (see design.service.ts's runDefenseTurn doc comment) and hits the real offline path.
 */
test("defending a graded design while AI is offline shows a clear offline notice", async ({ page }) => {
  await page.route("**/api/design/current", (route) => route.fulfill({ json: FIXTURE_EXERCISE }));

  await page.goto("/study");
  await page.getByRole("button", { name: "Architecture" }).click();
  await expect(page.getByRole("button", { name: "Defend your design" })).toBeVisible();
  await page.getByRole("button", { name: "Defend your design" }).click();

  await expect(page.getByText("A staff engineer will ask a few follow-up questions")).toBeVisible();

  const [defenseResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/design/defense") && res.request().method() === "POST"),
    page.getByRole("button", { name: "Start" }).click(),
  ]);
  expect(defenseResponse.ok()).toBeTruthy();
  const body = await defenseResponse.json();
  expect(body.offline).toBe(true);
  expect(body.done).toBe(true);

  await expect(page.getByText("AI offline — couldn't continue the interview.")).toBeVisible();
});
