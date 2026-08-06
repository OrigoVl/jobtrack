import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the Companies feature: add a company, edit its name/notes/questions via the
 * explicit Save button (not autosave-on-blur), confirm persistence across a reload, then delete
 * it — same shape as contacts.spec.ts's create/edit/delete test.
 */
test("adds a company, renames it and edits notes/questions via Save, persists, then deletes", async ({ page }) => {
  await page.goto("/companies");

  const name = `E2E Co ${Date.now()}`;
  const renamed = `${name} (Renamed)`;

  await page.getByLabel("Company name").fill(name);
  const [addRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/companies") && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add" }).click(),
  ]);
  expect(addRes.ok()).toBeTruthy();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  const companies = (await (await page.request.get("/api/companies")).json()) as { id: number; name: string }[];
  const company = companies.find((c) => c.name === name);
  expect(company).toBeTruthy();

  // Edit — name/notes/questions are a local draft until Save is clicked, no request fires just
  // from focusing the inputs. Saving an existing company PUTs by id (unlike "+ Add"'s POST) so a
  // name change actually renames the row instead of creating a duplicate.
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByLabel(`Rename ${name}`).fill(renamed);
  await page.getByLabel(`Notes about ${name}`).fill("Great culture, remote-friendly");
  await page.getByLabel(`Questions asked at ${name}`).fill("Why us?\nTell me about a challenge you faced");

  const [saveRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/companies/${company!.id}`) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  expect(saveRes.ok()).toBeTruthy();

  await expect(page.getByText(renamed, { exact: true })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Great culture, remote-friendly")).toBeVisible();
  await expect(page.getByText("Why us?")).toBeVisible();
  await expect(page.getByText("Tell me about a challenge you faced")).toBeVisible();

  // Persistence — reload the real page and confirm it survived, not just an optimistic update.
  await page.reload();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();
  await expect(page.getByText("Great culture, remote-friendly")).toBeVisible();

  // Delete — opens a shared confirm dialog (shared/confirm.tsx) before the mutation fires.
  await page.getByRole("button", { name: `Delete ${renamed}` }).click();
  const [deleteRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/companies/${company!.id}`) && r.request().method() === "DELETE"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
  expect(deleteRes.ok()).toBeTruthy();
  await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
});
