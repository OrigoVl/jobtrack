import { test, expect } from "./fixtures";
import { addVacancy } from "./helpers";

/**
 * The "Vacancy added" toast (shared/queries/vacancies.ts's useAddVacancy, rendered by App.tsx's
 * ToastHost) used to be a dead-end confirmation — nothing pointed back at where the new row
 * landed. It's now clickable and navigates to /vacancies. ToastHost is mounted at the app Shell
 * level (outside the routed content), so the toast survives a route change while it's still
 * alive — this spec proves that by navigating away right after the add and clicking the toast
 * from a different page, rather than from /vacancies itself (where a URL check wouldn't be able
 * to tell "it navigated" apart from "it never left").
 */

test("the 'Vacancy added' toast is clickable and navigates to /vacancies, even from a different page", async ({ page }) => {
  await page.goto("/vacancies");
  await addVacancy(page, { company: "Toast Nav Co", position: "Platform Engineer" });

  // A client-side route change (clicking the sidebar link), not page.goto() — that would trigger a
  // real browser navigation/full reload, remounting the whole SPA and wiping the toast's React
  // state along with it, which would trivially "pass" this spec for the wrong reason.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const toast = page.getByRole("button", { name: /Vacancy added/ });
  await expect(toast).toBeVisible();
  await toast.click();

  await expect(page).toHaveURL(/\/vacancies$/);
});
