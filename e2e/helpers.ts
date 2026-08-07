import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared steps for specs whose real subject is something else, but which need a vacancy to exist
 * first (the calendar's markers, the cover-letter picker, the Kanban board, the roadmap…).
 *
 * "+ Add vacancy" used to POST a placeholder row immediately; it now opens a blank create form
 * (features/vacancies/vacancy-create-modal.tsx) that only saves on an explicit Save, so "click the
 * button and wait for POST /vacancies" no longer describes the flow. Every such spec goes through
 * addVacancy() instead of spelling the form out again.
 */

/**
 * Gets a brand-new account past the one-time onboarding screen. App.tsx's WelcomeRedirect sends
 * any account whose server-side `onboarding.welcomeSeen` is still false to /welcome from anywhere
 * in the app — so a spec that registers its own throwaway user reaches /dashboard only after this,
 * and one that assumes otherwise watches the sidebar it just found get unmounted underneath it.
 * (The shared session from auth.setup.ts is long past this screen; only fresh users need it.)
 * The flow itself is welcome.spec.ts's subject, not this helper's.
 */
export async function skipWelcome(page: Page): Promise<void> {
  await page.waitForURL("**/welcome");
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/onboarding/welcome-seen") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Skip setup" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await page.waitForURL("**/dashboard");
}

/** The vacancy DETAIL modal (features/vacancies/vacancy-detail-modal.tsx). Both modals are
 * role="dialog", and the create one stays up until its Save round-trip finishes — so a bare
 * getByRole("dialog") right after Save can resolve to the modal that's on its way out. Narrowing
 * by the tab strip (which only the detail modal has) both disambiguates and waits for the
 * handover. */
export const detailDialog = (page: Page): Locator =>
  page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Cover letter" }) });

/**
 * Adds a vacancy through the create modal and returns the created row. Must be called on
 * /vacancies. Saving also opens the new row's detail modal — pass `closeDetail: false` when the
 * test wants to keep working in it.
 */
export async function addVacancy(
  page: Page,
  { company, position, closeDetail = true }: { company: string; position: string; closeDetail?: boolean },
): Promise<{
  id: number;
  company: string;
  position: string;
  /** Advisory near-duplicate flag from job-dedupe.ts — reported only in this POST's response. */
  possibleDuplicateOf: { company: string; position: string } | null;
}> {
  await page.getByRole("button", { name: "+ Add vacancy" }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel("Company", { exact: true }).fill(company);
  await createDialog.getByLabel("Position", { exact: true }).fill(position);

  const [response] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    createDialog.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();

  if (closeDetail) await closeDetailModal(page);
  return await response.json();
}

/**
 * Dismisses the detail modal that a save opens. With no unsaved draft edits it closes straight
 * away, no discard confirmation in between.
 *
 * The ✕ button, deliberately not Escape: the Escape handler is registered by a useEffect, which
 * React flushes asynchronously AFTER the modal is already in the DOM, so a keypress fired the
 * instant toBeVisible() passes can land before anything is listening — rare on an idle page, but
 * reproducible once enough rows make the post-save refetches slow. A click can't lose that race
 * (React's delegated handler is wired during the same commit that renders the button). Escape
 * itself is still covered, in vacancy-detail-modal.spec.ts.
 */
export async function closeDetailModal(page: Page): Promise<void> {
  const dialog = detailDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible();
}
