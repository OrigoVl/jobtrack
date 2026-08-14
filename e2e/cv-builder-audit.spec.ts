import { test, expect } from "./fixtures";

/**
 * End-to-end test of the CV Builder's "Audit" editor mode — the line-by-line résumé review.
 *
 * The point of this spec is that the audit's MECHANICAL half is real, offline work: e2e always
 * runs with the LLM disabled (playwright.config.ts), so everything exercised below comes from the
 * deterministic rule engine (client/src/features/cv/builder/cv-audit.ts) and the one-click apply
 * that writes straight back into the document. If this passes with no AI key, the feature genuinely
 * degrades to "fewer findings" rather than to "unavailable", which is the repo's rule for every AI
 * feature.
 *
 * The seeded document below is deliberately a CV with KNOWN, provable defects — a role that ends
 * on a concrete date instead of "Present", no location, a cliché summary opener, and a lowercase
 * role title under a Title Cased header.
 */
test("the audit finds real defects offline and applies a fix straight into the CV", async ({ page }) => {
  // The builder opens on a first-run start card while the doc is empty, so the audit mode this
  // spec drives only exists past that. Seeding through the real API is the deterministic option on
  // the shared e2e account (same approach as cv-builder-tailor.spec.ts).
  const profilesRes = await page.request.get("/api/cv/profiles");
  expect(profilesRes.ok()).toBeTruthy();
  const [profile] = (await profilesRes.json()) as { id: number }[];
  const seedRes = await page.request.put(`/api/cv/profiles/${profile!.id}/doc`, {
    data: {
      name: "E2E Audit Person",
      title: "Full Stack Developer",
      contact: "audit@example.com",
      // Deliberately empty — this is what the missing-location rule fires on.
      location: "",
      summary: "Results-driven developer with 7 years of experience building web applications.",
      skills: ["TypeScript"],
      experience: [
        // Lowercase role under a Title Cased header, and an end date rather than "Present".
        { role: "Full stack developer", company: "Acme", period: "Sep 2019 — Dec 2099", bullets: ["Shipped 4 features."] },
      ],
    },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");
  await page.getByRole("button", { name: /^Audit$/ }).click();

  // The mechanical findings appear with no "Run audit" click at all — they're derived from the
  // document, not fetched. That immediacy is the whole reason the rule engine is client-side.
  await expect(page.getByText("No location anywhere in the CV")).toBeVisible();
  await expect(page.getByText("Your current job looks like you've left it")).toBeVisible();
  await expect(page.getByText("The summary opens with a cliché")).toBeVisible();

  // A finding that can be fixed mechanically shows the exact replacement, not just a complaint.
  await expect(page.getByText("Sep 2019 — Present")).toBeVisible();

  // Applying writes back into the real document: switch to Content and the period field itself
  // has changed. This is the assertion that matters — a finding whose "Apply" didn't actually
  // edit the CV would still look right in the audit list.
  const dateFinding = page.locator("div.rounded-xl").filter({ hasText: "Your current job looks like you've left it" });
  await dateFinding.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Your current job looks like you've left it")).toBeHidden();

  await page.getByRole("button", { name: /^Content$/ }).click();
  await page.getByRole("button", { name: /^Experience/ }).click();
  await expect(page.locator('input[value="Sep 2019 — Present"]')).toBeVisible();

  // ...and a diagnostic finding (no single correct rewrite) offers a jump instead of an Apply,
  // since an "Apply" that did nothing would be worse than no button at all.
  await page.getByRole("button", { name: /^Audit$/ }).click();
  const cliche = page.locator("div.rounded-xl").filter({ hasText: "The summary opens with a cliché" });
  await expect(cliche.getByRole("button", { name: "Go fix it" })).toBeVisible();
});

/**
 * The bulk action must SHOW what it is about to change before it changes it. A button carrying
 * only a count ("apply 6 fixes") gives no way to tell which six of the findings are included, and
 * the honest response to that is not to press it.
 */
test("the bulk fix itemises every change before applying, and can be backed out of", async ({ page }) => {
  const profilesRes = await page.request.get("/api/cv/profiles");
  const [profile] = (await profilesRes.json()) as { id: number }[];
  const seedRes = await page.request.put(`/api/cv/profiles/${profile!.id}/doc`, {
    data: {
      name: "E2E Bulk Person",
      title: "Full Stack Developer",
      contact: "bulk@example.com",
      location: "Kyiv",
      summary: "Developer building web applications.",
      skills: ["TypeScript"],
      experience: [{ role: "Full stack developer", company: "Acme", period: "Sep 2019 — Dec 2099", bullets: ["Shipped 4 features."] }],
      education: [{ school: "Kharkiv Polytechnical Institute", degree: "M.Sc.", period: "2014 — 2020" }],
    },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");
  await page.getByRole("button", { name: /^Audit$/ }).click();

  // Pressing it opens a preview rather than mutating the document.
  await page.getByRole("button", { name: /quick fixes|quick fix/ }).click();
  await expect(page.getByText(/change(s)? will be applied/)).toBeVisible();
  // Each row states the actual replacement, not just the name of the problem. Scoped to the
  // preview's own list — the same text also appears on the finding card further down the page.
  const preview = page.getByRole("list").first();
  await expect(preview.getByText("Sep 2019 — Present")).toBeVisible();
  await expect(preview.getByText("Kharkiv Polytechnic Institute")).toBeVisible();

  // Backing out leaves the document untouched.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText(/change(s)? will be applied/)).toBeHidden();
  await page.getByRole("button", { name: /^Content$/ }).click();
  await page.getByRole("button", { name: /^Experience/ }).click();
  await expect(page.locator('input[value="Sep 2019 — Dec 2099"]')).toBeVisible();
});
