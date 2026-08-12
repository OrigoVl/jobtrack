import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * The opt-in extensions to the CV Builder: the "Technical" template, a per-job note and metric
 * strip, categorized skills, and `**bold**` markup.
 *
 * Every one is checked in the live PREVIEW rather than in the editor, because the claim each of
 * them makes is about what comes out in the PDF. The preview inherits the app's CSP and receives
 * its stylesheet through CSSOM (see cv-builder-preview.spec.ts), so what's read here is real.
 *
 * Driven through a profile this spec creates itself, for the same reason cv-builder-start.spec.ts
 * does: the e2e account is shared and several specs seed its DEFAULT profile, so "the doc holds
 * exactly this one job" is only deterministic somewhere nobody else writes.
 */
const CV_NAME = "E2E Extensions CV";

const JOB = {
  role: "Fullstack Developer",
  company: "Ascendix",
  period: "2021 - Present",
  note: "Composer Online - a document platform",
  metrics: [
    { value: "940+", label: "merged pull requests" },
    { value: "570+", label: "tickets delivered" },
  ],
  bullets: ["Owned the **AI condition engine** end to end"],
};

/** Creates this spec's own profile with `doc` in it and opens the builder on it. Idempotent
 * across local re-runs against a DB that wasn't reset — the account caps at 5 profiles
 * (MAX_CV_PROFILES), so leftovers would eventually fail the create rather than just pile up. */
async function openOwnProfile(page: Page, doc: Record<string, unknown>) {
  const existing = await page.request.get("/api/cv/profiles");
  expect(existing.ok()).toBeTruthy();
  for (const p of (await existing.json()) as { id: number; name: string }[]) {
    if (p.name === CV_NAME) await page.request.delete(`/api/cv/profiles/${p.id}`);
  }
  const created = await page.request.post("/api/cv/profiles", { data: { name: CV_NAME } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: number };
  const seeded = await page.request.put(`/api/cv/profiles/${id}/doc`, { data: doc });
  expect(seeded.ok()).toBeTruthy();

  await page.goto("/cvbuilder");
  // The builder opens on the first profile; switch through the header menu.
  await page.getByRole("button", { name: /^Current CV:/ }).click();
  await page.getByRole("button", { name: CV_NAME, exact: true }).click();
  await expect(page.locator('iframe[title="CV preview"]')).toBeVisible();
}

/** What the preview document says — i.e. what the PDF will say. */
async function previewText(page: Page): Promise<string> {
  return page.locator('iframe[title="CV preview"]').evaluate((el) => (el as HTMLIFrameElement).contentDocument?.body?.innerText ?? "");
}

async function previewHtml(page: Page): Promise<string> {
  return page.locator('iframe[title="CV preview"]').evaluate((el) => (el as HTMLIFrameElement).contentDocument?.body?.innerHTML ?? "");
}

test("the optional job note, metric strip and categorized skills all reach the preview", async ({ page }) => {
  await openOwnProfile(page, {
    name: "E2E Extensions Person",
    title: "Fullstack Developer",
    skills: ["TypeScript", "Vue"],
    skillGroups: [
      { name: "Frontend", skills: ["TypeScript", "Vue"] },
      { name: "Backend", skills: ["NestJS"] },
    ],
    experience: [JOB],
    theme: { template: "technical", accent: "#0f5257", font: "sans", scale: 1 },
  });

  await expect.poll(() => previewText(page)).toContain("Composer Online - a document platform");
  const text = await previewText(page);
  // The metric strip: the figure and its caption both print.
  expect(text).toContain("940+");
  expect(text).toContain("merged pull requests");
  // "Technical" defaults the skills style to grouped, so the categories print as a label grid
  // rather than as the flat chip row — including a skill only the groups know about. The category
  // name is matched case-insensitively: it is typed in title case and printed in small capitals
  // by CSS, which is exactly the difference innerText reports.
  expect(text).toMatch(/frontend/i);
  expect(text).toContain("TypeScript, Vue");
  expect(text).toContain("NestJS");
  // Employer before role, role in the accent: the head order this template is built around.
  expect(await previewHtml(page)).toContain('Ascendix — <span class="co">Fullstack Developer</span>');
});

test("markdown in bullets stays literal until the option is switched on", async ({ page }) => {
  await openOwnProfile(page, {
    name: "E2E Markdown Person",
    title: "Developer",
    skills: ["TypeScript"],
    experience: [JOB],
    theme: { template: "classic", accent: "#4f46e5", font: "sans", scale: 1 },
  });

  // Off by default — the asterisks are part of the printed sentence, not formatting. That
  // default is the whole back-compat guarantee for anyone whose CV already contains a "**".
  await expect.poll(() => previewText(page)).toContain("**AI condition engine**");
  expect(await previewHtml(page)).not.toContain("<strong>AI condition engine</strong>");

  await page.getByRole("button", { name: /^Appearance/ }).click();
  await page.getByRole("button", { name: /^Style/ }).click();
  await page.getByLabel(/Markdown in text/).check();

  await expect.poll(() => previewHtml(page)).toContain("<strong>AI condition engine</strong>");
  expect(await previewText(page)).not.toContain("**AI condition engine**");
});
