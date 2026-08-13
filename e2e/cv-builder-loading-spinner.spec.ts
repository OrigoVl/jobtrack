import { test, expect } from "@playwright/test";

/**
 * Regression test: AI-action buttons in the CV Builder used to only change their text to "…"
 * instead of a real animated spinner (`Btn loading` -> `<Spinner>` with `animate-spin`) — a user
 * reported not being able to tell whether anything was happening, since the text change was easy
 * to miss. Now `loading` shows an SVG icon.
 *
 * The "AI Assistant" button starts a BACKGROUND job (POST /cv/audit/start, see
 * server/src/modules/cv/cv-audit-job.ts) instead of blocking on a single request — the button's
 * `loading` state is derived from the polled job status (GET /cv/audit/status), not from the
 * start call itself. `useStartCvAuditJob`'s `onSuccess` seeds the job-status query with the
 * "running" job SYNCHRONOUSLY from the start response, and the first status poll can't land for
 * another ~1s (see queries/cv.ts's refetchInterval) — so the spinner is reliably visible for at
 * least that long, with no need to artificially delay any request via page.route().
 */
test("AI-analysis button shows a real animated spinner while the audit job is running", async ({ page }) => {
  // The audit's own guard rejects a doc with no summary AND no experience (cv.routes.ts), and a
  // freshly registered account's doc is empty (seed-vacancies.ts's EMPTY_PROFILE). Seeded through
  // the real API rather than by typing in the builder, which is another spec's subject.
  const profilesRes = await page.request.get("/api/cv/profiles");
  expect(profilesRes.ok()).toBeTruthy();
  const [profile] = (await profilesRes.json()) as { id: number }[];
  const seedRes = await page.request.put(`/api/cv/profiles/${profile!.id}/doc`, {
    data: {
      name: "E2E Review Person",
      title: "Frontend Developer",
      summary: "Frontend developer with 5 years of experience building React and TypeScript applications.",
    },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");
  // The action that triggers the whole-CV analysis is the toolbar's "AI Assistant" button; it
  // switches to the Audit editor mode and starts the background run there.
  const btn = page.getByRole("button", { name: "AI Assistant" });
  await expect(btn).toBeVisible();

  const [startResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cv/audit/start") && r.request().method() === "POST"),
    btn.click(),
  ]);
  expect(startResponse.ok()).toBeTruthy();

  const spinner = btn.locator("svg.animate-spin");
  await expect(spinner).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("aria-busy", "true");

  // Offline analysis (E2E always runs with the LLM off, playwright.config.ts) resolves the job
  // almost instantly once the background runner actually calls it — the button re-enables once a
  // status poll reports "done".
  await expect(spinner).not.toBeVisible();
  await expect(btn).toBeEnabled();
});
