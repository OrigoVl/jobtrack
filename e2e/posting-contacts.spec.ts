import { test, expect } from "@playwright/test";
import { addVacancy, detailDialog } from "./helpers";

/**
 * The "contacts a posting actually states" flow (vacancy detail → Overview tab). CI runs with no
 * LLM key (playwright.config.ts), which is exactly the interesting case here: the deterministic
 * pass in posting-contacts.ts is what answers offline, so this exercises the guarantee that
 * matters — an address is only ever returned because it is literally in the text.
 *
 * The detail modal is opened from the table AFTER the posting text is seeded: it isn't a routed
 * view, so a reload closes it, and its notes are read once when it mounts.
 */
const EMAIL = "iryna.melnyk@posting-test.example";
const HANDLE = "@iryna_hr_test";

test("finds the contact stated in a vacancy's own text and saves it", async ({ page }) => {
  await page.goto("/vacancies");

  const vacancy = await addVacancy(page, { company: "Posting Contacts Co", position: "Node.js Developer" });

  // Seed the posting text through the API rather than the textarea: this spec is about extraction,
  // not about the notes field's own save behavior (covered in vacancy-detail-modal.spec.ts).
  const seedRes = await page.request.put(`/api/vacancies/${vacancy.id}`, {
    data: { notes: `Контактна особа: Ірина Мельник\nРезюме надсилайте на ${EMAIL} або пишіть ${HANDLE}` },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.reload();
  await page.getByRole("button", { name: "Open details for Node.js Developer at Posting Contacts Co" }).first().click();
  const dialog = detailDialog(page);
  await expect(dialog).toBeVisible();

  const [extractRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contacts/extract") && r.request().method() === "POST"),
    dialog.getByRole("button", { name: "Find contacts in the posting" }).click(),
  ]);
  expect(extractRes.ok()).toBeTruthy();

  // Both channels the text states, and the name the label attaches to the address. Matched as
  // LINKS specifically: the notes textarea right above holds the same raw text, so a plain
  // getByText would resolve to both it and the result row.
  await expect(dialog.getByRole("link", { name: EMAIL })).toBeVisible();
  await expect(dialog.getByRole("link", { name: HANDLE })).toBeVisible();
  await expect(dialog.getByText("Ірина Мельник").first()).toBeVisible();

  const [addRes] = await Promise.all([
    page.waitForResponse((r) => /\/api\/contacts$/.test(r.url()) && r.request().method() === "POST"),
    dialog.getByRole("button", { name: "Save", exact: true }).first().click(),
  ]);
  expect(addRes.ok()).toBeTruthy();
  const created = (await addRes.json()) as { id: number };
  await expect(dialog.getByRole("button", { name: "Saved" }).first()).toBeVisible();

  // It landed as a real contact linked to this vacancy, not just a row in the results list — the
  // linked-contacts chips are rendered from the contacts query, not from the extraction result.
  await page.reload();
  await page.getByRole("button", { name: "Open details for Node.js Developer at Posting Contacts Co" }).first().click();
  await expect(detailDialog(page).getByText("Ірина Мельник").first()).toBeVisible();

  // Cleanup — the e2e account is shared across spec files.
  const deleteRes = await page.request.delete(`/api/contacts/${created.id}`);
  expect(deleteRes.ok()).toBeTruthy();
});

test("says so plainly when the posting states no contact details", async ({ page }) => {
  await page.goto("/vacancies");

  const vacancy = await addVacancy(page, { company: "No Contacts Co", position: "Backend Developer" });
  const seedRes = await page.request.put(`/api/vacancies/${vacancy.id}`, {
    data: { notes: "Шукаємо розробника. Подавайтесь через форму на сайті." },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.reload();
  await page.getByRole("button", { name: "Open details for Backend Developer at No Contacts Co" }).first().click();
  const dialog = detailDialog(page);

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contacts/extract") && r.request().method() === "POST"),
    dialog.getByRole("button", { name: "Find contacts in the posting" }).click(),
  ]);

  await expect(dialog.getByText("This text states no contact details")).toBeVisible();
});
