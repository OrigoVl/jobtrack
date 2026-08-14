import { test, expect } from "./fixtures";

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
 * Search finds a contact by the vacancy it's linked to — the case the card grid couldn't answer
 * ("the recruiter for that role, whatever her name was") — and the table view shows the same
 * filtered set. Two contacts are created so the assertion is that the OTHER one disappears, not
 * merely that the match is still on screen. Linked to a vacancy rather than a company because
 * fixtures.ts cleans vacancies up (and contacts before them); companies it does not.
 *
 * The view toggle also writes to localStorage, but each Playwright test gets a fresh context, so
 * leaving this one in the table view can't leak into the specs above that expect cards.
 */
test("searches contacts by linked vacancy and shows the same result in the table view", async ({ page }) => {
  const stamp = Date.now();
  const vacancyCompany = `E2E Searchable Corp ${stamp}`;
  const vacancyRes = await page.request.post("/api/vacancies", { data: { company: vacancyCompany, position: "Seed Role" } });
  expect(vacancyRes.ok()).toBeTruthy();
  const vacancy = (await vacancyRes.json()) as { id: number };

  const matchName = `E2E Search Match ${stamp}`;
  const otherName = `E2E Search Other ${stamp}`;
  for (const data of [
    { name: matchName, role: "Recruiter", vacancyId: vacancy.id },
    { name: otherName, role: "Recruiter" },
  ]) {
    expect((await page.request.post("/api/contacts", { data })).ok()).toBeTruthy();
  }

  await page.goto("/contacts");
  await expect(page.getByText(matchName, { exact: true })).toBeVisible();
  await expect(page.getByText(otherName, { exact: true })).toBeVisible();

  // Neither contact's own name contains the company, so this only matches via the linked vacancy.
  await page.getByLabel("Search contacts").fill(vacancyCompany);
  await expect(page.getByText(matchName, { exact: true })).toBeVisible();
  await expect(page.getByText(otherName, { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Table", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: matchName });
  await expect(row).toBeVisible();
  await expect(row.getByText(`${vacancyCompany} — Seed Role`)).toBeVisible();
  await expect(page.getByText(otherName, { exact: true })).toHaveCount(0);

  // Clicking the row is the table's way into the same edit modal the cards' Edit button opens.
  await row.click();
  await expect(page.getByLabel("Name")).toHaveValue(matchName);
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
