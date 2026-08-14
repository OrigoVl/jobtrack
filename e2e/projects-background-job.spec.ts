import { test, expect } from "./fixtures";

/**
 * Pet Projects' personalization used to run up to MAX_PERSONAL_PROJECTS parallel smart-tier LLM
 * calls SYNCHRONOUSLY inside GET /projects, blocking the page's first load on the slowest of them.
 * projects-job.ts now runs it as a fire-and-forget background job: GET /projects responds
 * instantly with the static ladder (or a previous run's sticky result) and kicks off generation in
 * the background; the client re-polls the same query (shared/queries/projects.ts's
 * refetchInterval) while `generating` is true, no separate status query needed.
 *
 * GET /projects only auto-starts a job when none exists yet (or the last one errored with no
 * result) — the job's result is deliberately STICKY (projects-job.ts's own header comment), so on
 * this suite's shared, persistent e2e account a prior spec run may already have left a "done" job
 * behind, and a plain page visit would see `generating: false` from its very first response,
 * never true. POST /projects/generate (the explicit "regenerate" action) always starts a fresh
 * run regardless of sticky state, so calling it first makes this deterministic without depending
 * on account history. E2E runs with the LLM forced offline (playwright.config.ts), so the job
 * always finishes almost immediately either way.
 */

test("POST /projects/generate starts a job in 'running' status without blocking on it", async ({ page }) => {
  const res = await page.request.post("/api/projects/generate");
  expect(res.status()).toBe(202);
  const job = await res.json();
  expect(job.status).toBe("running");
});

test("the Pet Projects page renders the static ladder instantly, and the background job settles to `generating: false`", async ({
  page,
}) => {
  // Kicks a fresh run regardless of any sticky result a prior spec left behind on this suite's
  // shared, persistent e2e account (projects-job.ts's result is deliberately sticky across runs —
  // see this file's header comment) — otherwise GET /projects's auto-start ("only when no job
  // exists yet") might see an already-"done" job and never report `generating: true` at all.
  await page.request.post("/api/projects/generate");

  const responses: boolean[] = [];
  page.on("response", async (r) => {
    if (!/\/api\/projects$/.test(r.url()) || r.request().method() !== "GET") return;
    try {
      const body = await r.json();
      if (typeof body?.generating === "boolean") responses.push(body.generating);
    } catch {
      // ignore non-JSON/aborted responses
    }
  });

  await page.goto("/projects");

  // Instant static/sticky-ladder render — not blocked on any background generation, regardless of
  // whether the job we just started has already finished by the time this GET lands (e2e's
  // offline path is fast enough that either order is possible and both must render instantly).
  await expect(page.getByText("Repo Explorer")).toBeVisible();

  // Whatever the first response's `generating` was, it must have settled to false — and if the
  // "Personalizing…" chip ever showed up, it must be gone by now too — proving the page never gets
  // stuck showing a background job as perpetually in progress.
  await expect(page.getByText("Personalizing…")).not.toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() => responses[responses.length - 1], { timeout: 10_000, message: "the latest GET /projects should report generating:false" })
    .toBe(false);
});
