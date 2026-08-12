import { test, expect } from "./fixtures";

const BLANK_CV_NAME = "E2E Blank CV";

/**
 * End-to-end test of the CV Builder's first-run experience (cv-builder.tsx): while a CV profile's
 * doc is still completely empty there is nothing to preview and nothing to score, so the editor
 * column shows ONE start card — bring an existing CV in, or start blank — instead of the eleven
 * empty content accordions, which offered eleven equally-plausible places to begin.
 *
 * Driven through a CV profile this spec creates itself rather than the account's default one: the
 * e2e account is shared across spec files and several of them seed that default doc, so "is the
 * doc empty" is only deterministic on a profile nobody else touches. Switching to it also
 * exercises the profile switcher that replaced the old tab strip (it's now the page header's
 * "Current CV" menu, not a third row of tabs).
 */
test("a brand-new CV opens on the start card, and 'fill it in manually' reveals the section list", async ({ page }) => {
  // Idempotent across local re-runs against a DB that wasn't reset — the account has a hard cap
  // of 5 CV profiles (MAX_CV_PROFILES), so leftovers from a previous run would eventually make
  // the create below fail rather than just pile up.
  const existingRes = await page.request.get("/api/cv/profiles");
  expect(existingRes.ok()).toBeTruthy();
  for (const p of (await existingRes.json()) as { id: number; name: string }[]) {
    if (p.name === BLANK_CV_NAME) await page.request.delete(`/api/cv/profiles/${p.id}`);
  }

  const createRes = await page.request.post("/api/cv/profiles", { data: { name: BLANK_CV_NAME } });
  expect(createRes.status()).toBe(201);
  const blank = (await createRes.json()) as { id: number };

  // A new profile is NOT reliably blank: emptyCvDoc() seeds its title from the account profile's
  // `domain`, which other specs in the run fill in (a CV upload applies the extracted domain).
  // On a persistent database that survives into the next run, so the profile arrives with a title
  // already typed and the start card — the entire subject of this test — never appears. Writing
  // an empty doc makes the precondition this test needs its own responsibility rather than a
  // property of whatever else ran first.
  const blankRes = await page.request.put(`/api/cv/profiles/${blank.id}/doc`, { data: {} });
  expect(blankRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");

  // The builder opens on the first profile; switch to the blank one through the header menu.
  await page.getByRole("button", { name: /^Current CV:/ }).click();
  await page.getByRole("button", { name: BLANK_CV_NAME, exact: true }).click();

  // The start card, and nothing else: no completeness meter, no accordion list.
  await expect(page.getByText("Let's build your CV")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Skills/ })).toHaveCount(0);
  await expect(page.getByText("Resume completeness")).toHaveCount(0);

  await page.getByRole("button", { name: /^Fill it in manually/ }).click();

  // Past the choice, the normal editor is there — including the completeness meter, whose
  // "missing" items are now buttons that open the section they name.
  await expect(page.getByRole("button", { name: /^Skills/ })).toBeVisible();
  await expect(page.getByText("Resume completeness")).toBeVisible();
  await page.getByRole("button", { name: "Go to section: Skills" }).click();
  await expect(page.getByPlaceholder("Search skill…")).toBeVisible();

  await page.request.delete(`/api/cv/profiles/${blank.id}`);
});
