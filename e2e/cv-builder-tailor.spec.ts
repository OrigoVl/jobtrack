import { test, expect } from "./fixtures";
import { addVacancy } from "./helpers";

/**
 * End-to-end test of "Tailor CV" (POST /cv/tailor, cv-builder.tsx): adapts the CV Builder doc
 * to a specific vacancy — reorders the candidate's own skills/experience bullets by relevance
 * (a deterministic algorithm, works offline too — see cv-tailor.service.ts) and swaps in a
 * rewritten summary only when the LLM actually produced one. E2E always runs with the LLM
 * offline (playwright.config.ts), so this exercises the offline path end-to-end: the network
 * round trip, the new "Tailored CV" report tab, and applying the result back to the builder.
 */
test("tailoring the CV for a selected vacancy shows a report tab and can be applied to the builder", async ({ page }) => {
  await page.goto("/vacancies");
  await addVacancy(page, { company: "Tailor Corp", position: "Frontend Developer" });

  // The builder opens on a first-run start card (import a CV / start blank) while the doc is
  // still completely empty — the section list this spec drives only exists past that choice. Give
  // the doc a name/title through the real API so it's past the empty state no matter which other
  // specs did or didn't run against this shared account first (cv-builder-start.spec.ts is the
  // one that covers the empty state itself, on a profile it creates for exactly that purpose).
  const profilesRes = await page.request.get("/api/cv/profiles");
  expect(profilesRes.ok()).toBeTruthy();
  const [profile] = (await profilesRes.json()) as { id: number }[];
  const seedRes = await page.request.put(`/api/cv/profiles/${profile!.id}/doc`, {
    data: { name: "E2E Tailor Person", title: "Frontend Developer" },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");

  // Give the CV at least one skill so /cv/tailor has something to work with (its guard rejects
  // a completely empty doc).
  await page.getByRole("button", { name: /^Skills/ }).click();
  const skillInput = page.getByPlaceholder("Search skill…");
  await skillInput.fill("React");
  await skillInput.press("Enter");
  await expect(page.getByLabel("Remove React")).toBeVisible();

  // The vacancy picker inside this dropdown is a SearchSelect (shared/ui.tsx) — a combobox that
  // filters as you type, portaled outside the dropdown panel. Picking from it must NOT dismiss
  // the dropdown around it (that's what the `data-keep-open` marker on both the field and its
  // list buys); if it did, "Tailor CV" below would never become enabled.
  await page.getByRole("button", { name: /^Vacancy/ }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /Frontend Developer/ }).click();

  const tailorBtn = page.getByRole("button", { name: "Tailor CV" });
  await expect(tailorBtn).toBeEnabled();
  await tailorBtn.click();

  // /^Tailored for/, not just /^Tailored/ — a toast reading "Tailored offline — …" appears at the
  // same time, and now that emoji no longer set the two strings apart, a bare /^Tailored/ regex
  // matches both (strict-mode violation).
  await expect(page.getByText(/^Tailored for/)).toBeVisible();

  const applyBtn = page.getByRole("button", { name: "Apply to CV" });
  await applyBtn.click();
  await expect(page.getByText("Tailored version applied to the builder — remember to Save")).toBeVisible();
});
