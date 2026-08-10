import { test, expect } from "@playwright/test";

const SAVE_CV_NAME = "E2E Save CV";

/**
 * End-to-end test of the CV Builder's save model (cv-builder.tsx). Editing used to fire a
 * debounced PUT ~1.5s after every keystroke, which persisted everything before you could decide
 * you wanted it and left the Save button with nothing to do. Saving is now EXPLICIT — typing
 * writes nothing, Save writes — with one safety net: leaving the editor (in-app navigation, a
 * profile switch, or the tab going to the background) flushes whatever is still unsaved, so the
 * stricter model can't cost anyone their work.
 *
 * Driven through a CV profile this spec creates itself: the e2e account is shared across spec
 * files and several of them seed the default profile's doc, so "exactly this many writes went to
 * this doc" is only deterministic on a profile nobody else touches.
 */
test("the CV Builder writes only on Save, and flushes what's unsaved when you navigate away", async ({ page }) => {
  // Idempotent across local re-runs against a DB that wasn't reset — the account caps CV profiles
  // (MAX_CV_PROFILES), so leftovers from a previous run would eventually fail the create below.
  const existingRes = await page.request.get("/api/cv/profiles");
  expect(existingRes.ok()).toBeTruthy();
  for (const p of (await existingRes.json()) as { id: number; name: string }[]) {
    if (p.name === SAVE_CV_NAME) await page.request.delete(`/api/cv/profiles/${p.id}`);
  }
  const createRes = await page.request.post("/api/cv/profiles", { data: { name: SAVE_CV_NAME } });
  expect(createRes.status()).toBe(201);
  const cv = (await createRes.json()) as { id: number };
  // Past the first-run start card, so the General accordion this spec types into is on screen.
  const seedRes = await page.request.put(`/api/cv/profiles/${cv.id}/doc`, {
    data: { name: "E2E Save Person", title: "Frontend Developer" },
  });
  expect(seedRes.ok()).toBeTruthy();

  // Counts every doc write the PAGE makes (page.request calls above don't go through here), which
  // is what proves typing produced none — an assertion no waitForResponse can express.
  const docWrites: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes(`/api/cv/profiles/${cv.id}/doc`)) docWrites.push(r.url());
  });
  const docWrite = () => page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes(`/api/cv/profiles/${cv.id}/doc`));

  await page.goto("/cvbuilder");
  await page.getByRole("button", { name: /^Current CV:/ }).click();
  await page.getByRole("button", { name: SAVE_CV_NAME, exact: true }).click();

  const titleInput = page.getByLabel("Role / title");
  await expect(titleInput).toHaveValue("Frontend Developer");
  await titleInput.fill("Staff Engineer");
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  // The old autosave landed ~1.5s after the last keystroke; wait well past that and show that
  // nothing was written and the Save button is still the thing holding the change.
  await page.waitForTimeout(2500);
  expect(docWrites).toHaveLength(0);
  await expect(page.getByText("Unsaved changes")).toBeVisible();

  const saveBtn = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveBtn).toBeEnabled();
  await Promise.all([docWrite(), saveBtn.click()]);
  await expect(page.getByText("All changes saved")).toBeVisible();
  // Nothing left to save — the button says so instead of pretending another write is available.
  await expect(saveBtn).toBeDisabled();
  expect(docWrites).toHaveLength(1);

  // The safety net: edit again, then leave the builder through an in-app link (which unmounts it)
  // without pressing Save.
  await titleInput.fill("Principal Engineer");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await Promise.all([docWrite(), page.getByRole("link", { name: "Cover letter" }).click()]);
  expect(docWrites).toHaveLength(2);

  const docRes = await page.request.get(`/api/cv/profiles/${cv.id}/doc`);
  expect(docRes.ok()).toBeTruthy();
  expect(((await docRes.json()) as { title: string }).title).toBe("Principal Engineer");

  await page.request.delete(`/api/cv/profiles/${cv.id}`);
});
