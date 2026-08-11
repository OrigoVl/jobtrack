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

/**
 * A conversation that went quiet gets flagged, and the one action offered clears it. Seeded
 * through the API with a date well past the 7-day threshold, so the spec doesn't depend on how
 * long ago some other spec's fixture was written.
 */
test("flags a contact who has gone quiet, and clears the flag once you say you've written", async ({ page }) => {
  const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
  // Unique per run: the e2e account is shared, and a row left behind by an interrupted run would
  // otherwise make the card locator ambiguous rather than failing loudly on its own terms.
  const name = `E2E Quiet Conversation ${Date.now()}`;
  const createRes = await page.request.post("/api/contacts", {
    data: { name, role: "Recruiter", lastContactAt: longAgo },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = (await createRes.json()) as { id: number };

  await page.goto("/contacts");
  // Scoped to this contact's own Card (shared/ui.tsx renders it with `rounded-card`): the account
  // is shared across spec files, so an unrelated quiet contact must not satisfy these assertions.
  const card = page.locator("div.rounded-card").filter({ hasText: name });
  await expect(card.getByText(/quiet for \d+ days/)).toBeVisible();

  const [updateRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/contacts/${created.id}`) && r.request().method() === "PUT"),
    card.getByRole("button", { name: "I've written today" }).click(),
  ]);
  expect(updateRes.ok()).toBeTruthy();
  expect((await updateRes.json()).lastContactAt).toBe(new Date().toLocaleDateString("en-CA"));

  // The flag is derived from the date, so recording today's contact is what makes it go away —
  // there is no separate "dismissed" state to drift out of sync with reality.
  await expect(card.getByText(/quiet for \d+ days/)).toBeHidden();

  const deleteRes = await page.request.delete(`/api/contacts/${created.id}`);
  expect(deleteRes.ok()).toBeTruthy();
});
