import { test, expect } from "@playwright/test";

/**
 * End-to-end test of "✨ Tailor CV" (POST /cv/tailor, cv-builder.tsx): adapts the CV Builder doc
 * to a specific vacancy — reorders the candidate's own skills/experience bullets by relevance
 * (a deterministic algorithm, works offline too — see cv-tailor.service.ts) and swaps in a
 * rewritten summary only when the LLM actually produced one. E2E always runs with the LLM
 * offline (playwright.config.ts), so this exercises the offline path end-to-end: the network
 * round trip, the new "Tailored CV" report tab, and applying the result back to the builder.
 */
test("tailoring the CV for a selected vacancy shows a report tab and can be applied to the builder", async ({ page }) => {
  await page.goto("/vacancies");
  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => /\/api\/vacancies$/.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add vacancy" }).click(),
  ]);
  expect(addResponse.ok()).toBeTruthy();

  await page.goto("/cvbuilder");

  // Give the CV at least one skill so /cv/tailor has something to work with (its guard rejects
  // a completely empty doc).
  await page.getByRole("button", { name: /^Skills/ }).click();
  const skillInput = page.getByPlaceholder("Search skill…");
  await skillInput.fill("React");
  await skillInput.press("Enter");
  await expect(page.getByLabel("Remove React")).toBeVisible();

  await page.getByRole("button", { name: /^🎯 Vacancy/ }).click();
  await page.getByRole("combobox").selectOption({ index: 1 }); // newest vacancy first (ORDER BY id DESC)

  const tailorBtn = page.getByRole("button", { name: "✨ Tailor CV" });
  await expect(tailorBtn).toBeEnabled();
  await tailorBtn.click();

  await expect(page.getByText(/^✨ Tailored/)).toBeVisible();

  const applyBtn = page.getByRole("button", { name: "✅ Apply to CV" });
  await applyBtn.click();
  await expect(page.getByText("Tailored version applied to the builder — remember to Save")).toBeVisible();
});
