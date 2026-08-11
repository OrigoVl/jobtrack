import { test, expect } from "@playwright/test";

/**
 * The Skills section of the CV Builder: reordering the skills by hand, and the Appearance panel's
 * controls over how they render (chips / inline / list, plus chip shape and fill).
 *
 * Both halves are checked against the live preview iframe rather than just the editor, since the
 * point of either feature is what comes out in the PDF. The preview inherits the app's CSP and
 * gets its stylesheet through CSSOM (see cv-builder-preview.spec.ts), so the computed styles read
 * here are the real ones.
 */

/** The builder opens on a first-run start card while the doc is empty, so the section accordions
 * don't exist yet — seed through the real API on the shared e2e account (same approach as
 * cv-builder-tailor.spec.ts) and give it the skills this spec reorders. */
async function seedSkills(page: import("@playwright/test").Page, skills: string[]) {
  const profilesRes = await page.request.get("/api/cv/profiles");
  expect(profilesRes.ok()).toBeTruthy();
  const [profile] = (await profilesRes.json()) as { id: number }[];
  const seedRes = await page.request.put(`/api/cv/profiles/${profile!.id}/doc`, {
    data: { name: "E2E Skills Person", title: "Frontend Developer", skills },
  });
  expect(seedRes.ok()).toBeTruthy();
}

/** The skills as the PREVIEW renders them, in order — i.e. what the PDF will say. */
async function previewSkills(page: import("@playwright/test").Page): Promise<string[]> {
  return page
    .locator('iframe[title="CV preview"]')
    .evaluate((el) =>
      [...(el as HTMLIFrameElement).contentDocument!.querySelectorAll('[data-section="skills"] .chip, [data-section="skills"] li')].map(
        (n) => n.textContent?.trim() ?? "",
      ),
    );
}

test("reordering a skill with the keyboard changes the order the CV renders them in", async ({ page }) => {
  await seedSkills(page, ["React", "Node.js", "SQL"]);
  await page.goto("/cvbuilder");

  await page.getByRole("button", { name: /^Skills/ }).click();
  await expect(previewSkills(page)).resolves.toEqual(["React", "Node.js", "SQL"]);

  // Arrow keys, not drag-and-drop: this is the path that works without a mouse at all, and the
  // one that has to keep focus on the chip that moved so a second press moves the SAME skill.
  const sql = page.getByRole("button", { name: /^SQL — position 3 of 3/ });
  await sql.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(previewSkills(page)).resolves.toEqual(["React", "SQL", "Node.js"]);

  await page.keyboard.press("ArrowLeft");
  await expect(previewSkills(page)).resolves.toEqual(["SQL", "React", "Node.js"]);

  // The reorder is a normal doc edit, so it survives a save/reload like any other.
  await page.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await expect(previewSkills(page)).resolves.toEqual(["SQL", "React", "Node.js"]);
});

test("the Appearance panel switches how skills render, and restyles the chips", async ({ page }) => {
  await seedSkills(page, ["React", "Node.js", "SQL"]);
  await page.goto("/cvbuilder");
  await page.getByRole("button", { name: /^Appearance/ }).click();
  await page.getByRole("button", { name: /^Skills/ }).click();

  const chipStyle = () =>
    page.locator('iframe[title="CV preview"]').evaluate((el) => {
      const chip = (el as HTMLIFrameElement).contentDocument!.querySelector('[data-section="skills"] .chip');
      return chip ? getComputedStyle(chip).borderRadius : null;
    });

  // Default: the 6px corners chips have always had.
  await expect(chipStyle()).resolves.toBe("6px");
  await page.getByRole("button", { name: "Pill", exact: true }).click();
  await expect(chipStyle()).resolves.toBe("999px");

  // Switching the style away from chips changes the markup, not just the CSS — the skills come
  // out as a real <ul>, and the chip-only controls step aside.
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(chipStyle()).resolves.toBeNull();
  await expect(previewSkills(page)).resolves.toEqual(["React", "Node.js", "SQL"]);
  await expect(page.getByRole("button", { name: "Pill", exact: true })).toBeHidden();
});
