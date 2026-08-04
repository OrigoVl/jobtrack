import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the Contacts (networking tracker) feature: create/edit/delete a contact,
 * each step confirmed via the real mutation's response, and persistence checked across a real
 * page reload — same shape as calendar.spec.ts's manual-event test.
 */
test("creates, edits, and deletes a contact, persisting across reload", async ({ page }) => {
  await page.goto("/contacts");

  const name = "E2E Contact — Jane Recruiter";
  const editedName = "E2E Contact — Jane Recruiter (Senior)";

  await page.getByRole("button", { name: "+ Add contact" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Role").fill("Technical Recruiter");
  await page.getByLabel("Email").fill("jane.recruiter@example.test");

  const [createRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contacts") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { id: number };

  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText("Technical Recruiter")).toBeVisible();

  // Persistence — reload the real page and confirm it survived, not just an optimistic update.
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  // Edit.
  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await page.getByLabel("Name").fill(editedName);
  const [updateRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/contacts/${created.id}`) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(updateRes.ok()).toBeTruthy();
  await expect(page.getByText(editedName, { exact: true })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);

  // Delete — opens a shared confirm dialog (shared/confirm.tsx) before the mutation fires.
  await page.getByRole("button", { name: `Delete ${editedName}` }).click();
  const [deleteRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/contacts/${created.id}`) && r.request().method() === "DELETE"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
  expect(deleteRes.ok()).toBeTruthy();
  await expect(page.getByText(editedName, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(editedName, { exact: true })).toHaveCount(0);
});
