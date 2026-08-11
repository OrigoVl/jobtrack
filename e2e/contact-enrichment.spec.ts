import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the contact-enrichment panel (/contacts): CI runs with no enrichment
 * provider keys configured, so this exercises the always-available keyless pattern-guess
 * fallback deterministically (offline: true) — same "prove it in the state CI actually runs in"
 * approach as contacts.spec.ts's manual-contact flow. Covers search → guessed results → save one
 * as a real contact → persistence across reload, then cleans up so the shared e2e DB stays stable.
 */
test("finds pattern-guessed contacts and saves one as a real contact", async ({ page }) => {
  await page.goto("/contacts");

  await page.getByRole("button", { name: "Find contacts" }).click();

  await page.getByPlaceholder("Company name").fill("Acme Test Co");
  await page.getByPlaceholder("e.g. acme.com").fill("example.test");
  await page.getByLabel("Targeting a specific person? (optional)").fill("Jane Doe");

  const [enrichRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contacts/enrich") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Search", exact: true }).click(),
  ]);
  expect(enrichRes.ok()).toBeTruthy();
  const body = (await enrichRes.json()) as { offline: boolean; results: { email: string }[] };
  expect(body.offline).toBe(true);
  // More than one, specifically: every guess for the same person carries the same LinkedIn *search*
  // link, which dedupe must not mistake for an identity and collapse them all into one row.
  expect(body.results.length).toBeGreaterThan(1);
  const firstGuessedEmail = body.results[0]!.email;
  expect(firstGuessedEmail).toContain("@example.test");

  await expect(page.getByText("Only pattern-based guesses", { exact: false })).toBeVisible();
  await expect(page.getByText("Guessed").first()).toBeVisible();
  await expect(page.getByText(firstGuessedEmail).first()).toBeVisible();

  // Save the top-confidence guess as a real contact.
  const [addRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contacts") && r.request().method() === "POST" && !r.url().includes("/enrich")),
    page.getByRole("button", { name: "Save as contact" }).first().click(),
  ]);
  expect(addRes.ok()).toBeTruthy();
  const created = (await addRes.json()) as { id: number };
  await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible();

  // Confirm it actually landed in the real contacts list, not just an optimistic UI update — the
  // enrichment panel collapses/resets on reload, so this only passes if the main list rendered it.
  await page.reload();
  await expect(page.getByText(firstGuessedEmail).first()).toBeVisible();

  // Cleanup — same pattern as contacts.spec.ts, keep the shared e2e DB stable across runs.
  await page.getByRole("button", { name: "Delete Jane Doe" }).click();
  const [deleteRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/contacts/${created.id}`) && r.request().method() === "DELETE"),
    page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click(),
  ]);
  expect(deleteRes.ok()).toBeTruthy();
});

/** A named person at an unknown domain has no address to guess — the panel must still hand back the
 * LinkedIn lead it would give for the company alone, not an empty "no contacts found". */
test("still returns a LinkedIn lead when the domain is unknown", async ({ page }) => {
  await page.goto("/contacts");

  await page.getByRole("button", { name: "Find contacts" }).click();
  await page.getByPlaceholder("Company name").fill("Acme Test Co");
  await page.getByLabel("Targeting a specific person? (optional)").fill("John Roe");

  const [enrichRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contacts/enrich") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Search", exact: true }).click(),
  ]);
  const body = (await enrichRes.json()) as { results: { name: string; email: string; linkedinUrl: string }[] };
  expect(body.results).toHaveLength(1);
  expect(body.results[0]!.name).toBe("John Roe");
  expect(body.results[0]!.linkedinUrl).toContain("linkedin.com");

  await expect(page.getByText("No contacts found")).toBeHidden();
  await expect(page.getByText("John Roe")).toBeVisible();
});
