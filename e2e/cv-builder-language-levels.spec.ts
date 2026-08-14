import { test, expect } from "./fixtures";

/**
 * CV Builder's language-level picker (extra-sections-cards.tsx's LANGUAGE_LEVELS) used to offer
 * "Conversational" alongside the letter scale (A1–C2, Native) — dropped since it roughly
 * duplicates B1 and read as inconsistent next to an all-letter scale. A CV saved with that value
 * before the change must still display and stay editable, so it isn't silently dropped from the
 * dropdown for a row that already has it, only from the list offered to a NEW row.
 *
 * Own profile + seeded doc, for the same reason cv-builder-extensions.spec.ts uses one: the e2e
 * account's default CV profile is shared and mutated by other specs.
 */
const CV_NAME = "E2E Language Levels CV";

async function openOwnProfile(page: import("@playwright/test").Page, languages: { name: string; level: string }[]) {
  const existing = await page.request.get("/api/cv/profiles");
  expect(existing.ok()).toBeTruthy();
  for (const p of (await existing.json()) as { id: number; name: string }[]) {
    if (p.name === CV_NAME) await page.request.delete(`/api/cv/profiles/${p.id}`);
  }
  const created = await page.request.post("/api/cv/profiles", { data: { name: CV_NAME } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  const seeded = await page.request.put(`/api/cv/profiles/${id}/doc`, {
    data: { name: "E2E Language Person", title: "Engineer", languages },
  });
  expect(seeded.ok()).toBeTruthy();

  await page.goto("/cvbuilder");
  await page.getByRole("button", { name: /^Current CV:/ }).click();
  await page.getByRole("button", { name: CV_NAME, exact: true }).click();
  await page.getByRole("button", { name: /^Languages/ }).click();
}

test("a new language row does not offer 'Conversational' as a level, but does offer the letter scale and Native", async ({ page }) => {
  await openOwnProfile(page, []);

  await page.getByRole("button", { name: "+ Add a language", exact: true }).click();
  const levelSelect = page.getByRole("combobox", { name: "Level", exact: true });
  await expect(levelSelect).toBeVisible();
  const optionLabels = await levelSelect.locator("option").allTextContents();

  expect(optionLabels).not.toContain("Conversational");
  expect(optionLabels).toEqual(expect.arrayContaining(["A1", "A2", "B1", "B2", "C1", "C2", "Native"]));
});

test("a language saved with the legacy 'Conversational' level still displays and stays selectable", async ({ page }) => {
  await openOwnProfile(page, [{ name: "French", level: "Conversational" }]);

  const levelSelect = page.getByRole("combobox", { name: "Level", exact: true });
  await expect(levelSelect).toHaveValue("Conversational");
  // The dropdown for this EXISTING row still lists Conversational (so switching to something else
  // and back doesn't lose the option) — this is the one case where it's still offered.
  const optionLabels = await levelSelect.locator("option").allTextContents();
  expect(optionLabels).toContain("Conversational");
});
