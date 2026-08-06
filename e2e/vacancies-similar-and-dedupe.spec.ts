import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for two advisory (never-blocking) signals surfaced on the Vacancies table:
 * - a SimHash near-duplicate warning toast when a newly-added vacancy reads as the same posting
 *   as one already tracked (server/src/modules/jobs/job-dedupe.ts#findSimhashDuplicate, wired
 *   into POST /vacancies).
 * - the "Similar vacancies" popover (GET /vacancies/:id/similar, pgvector cosine similarity).
 *   E2E always runs with the LLM/embeddings offline (playwright.config.ts strips both API keys),
 *   so this can only exercise the "nothing found yet" empty state here — the actual similarity
 *   ranking math is covered by vacancies.repo.test.ts's integration tests against real vectors.
 */
test("flags a likely duplicate (without blocking the add) when a near-identical vacancy already exists", async ({ page }) => {
  await page.goto("/vacancies");

  // Not asserting a specific "Vacancy added" toast on the first add: other specs in the same
  // suite run (shared e2e DB, no per-test reset — see playwright.config.ts) may have already
  // left a same-named "New company"/"Position" row behind, which would make even THIS first add
  // read as a duplicate of THAT one. The assertions below only depend on the two adds in this
  // test being near-duplicates of EACH OTHER, which always holds regardless of prior state —
  // and on the response bodies (not a DOM row count, which the same shared state makes fragile
  // to assert an exact value for).
  const [firstAddRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vacancies") && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  expect(firstAddRes.ok()).toBeTruthy();
  const firstAddBody = (await firstAddRes.json()) as { id: number };
  expect(firstAddBody.id).toEqual(expect.any(Number));

  // "+ Add vacancy" now opens the detail modal for filling it in right away (see
  // vacancy-detail-modal.tsx) — close it, or the second "+ Add vacancy" click below (now covered
  // by the modal's backdrop) wouldn't actually reach the button. Waiting for it to actually be
  // visible first matters: it opens from the add-mutation's success callback, a render cycle
  // after the awaited network response above, so it isn't necessarily on-screen yet.
  const firstAddDialog = page.getByRole("dialog");
  await expect(firstAddDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(firstAddDialog).not.toBeVisible();

  // Same default "New company" / "Position" text as the first — a trivial near-duplicate.
  const [secondAddRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vacancies") && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  expect(secondAddRes.ok()).toBeTruthy();
  const secondAddBody = (await secondAddRes.json()) as { id: number; possibleDuplicateOf: { company: string; position: string } | null };
  // Genuinely a second, separate row (not e.g. an upsert silently reusing the first's id) — this
  // is what actually proves "flagged, not blocked", rather than a DOM row count that's fragile
  // against other specs' leftover rows in the same shared e2e database.
  expect(secondAddBody.id).not.toBe(firstAddBody.id);
  expect(secondAddBody.possibleDuplicateOf).not.toBeNull();

  // `.first()` — if this test's own first add ALSO happened to read as a duplicate of a
  // same-named row another spec left behind, its toast would carry identical text to the
  // second add's, and there'd be two matching elements on screen at once.
  await expect(page.getByText("looks similar to an existing one").first()).toBeVisible();
});

test("the similar-vacancies popover opens, fetches lazily, and reports nothing found when offline", async ({ page }) => {
  await page.goto("/vacancies");

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vacancies") && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  // "+ Add vacancy" now opens the detail modal (vacancy-detail-modal.tsx), which has its own
  // "Similar vacancies" button too — close it so the table's own button (what this test actually
  // exercises) isn't obscured by the modal's backdrop. Waiting for it to actually be visible
  // first matters: it opens from the add-mutation's success callback, a render cycle after the
  // awaited network response above, so it isn't necessarily on-screen yet.
  const addDialog = page.getByRole("dialog");
  await expect(addDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addDialog).not.toBeVisible();

  // .first() — this spec file's other test may have already added rows to the same shared e2e
  // DB (no per-test reset, only once per suite run, see playwright.config.ts), so more than one
  // row's identically-labeled button can be present; this test only cares that clicking ANY one
  // of them lazily fetches and renders the empty state.
  const similarButton = page.getByRole("button", { name: "Similar vacancies" }).first();
  const [similarRes] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies\/\d+\/similar$/.test(r.url())),
    similarButton.click(),
  ]);
  expect(similarRes.ok()).toBeTruthy();

  await expect(page.getByText("Similar vacancies")).toBeVisible();
  await expect(page.getByText("Nothing similar found yet")).toBeVisible();
});
