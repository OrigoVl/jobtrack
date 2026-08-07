import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the shareable public CV link: generate it from the CV Builder, confirm the
 * PUBLIC page (no session at all — a fresh, unauthenticated browser context) renders the real
 * doc content, then confirm disabling it takes the link down immediately.
 */
test("generates a public CV link, viewable without any session, and disables cleanly", async ({ page, context }) => {
  // Seeds distinctive content directly via the real API (not the focus of this test, which is
  // the share-link flow, not the CV Builder's own field-editing UI — already covered by other
  // cv-builder-*.spec.ts files). The doc hangs off a CV PROFILE now (multiple CVs per account),
  // so it's addressed as /cv/profiles/:id/doc; GET /cv/profiles creates the default one if the
  // account somehow has none yet (ensureProfiles), and that first one is what the builder opens.
  const profilesRes = await page.request.get("/api/cv/profiles");
  expect(profilesRes.ok()).toBeTruthy();
  const [profile] = (await profilesRes.json()) as { id: number }[];
  const seedRes = await page.request.put(`/api/cv/profiles/${profile!.id}/doc`, {
    data: { name: "E2E Public CV Person", title: "E2E Test Engineer" },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");

  // Share links hang off a CV profile too (/cv/profiles/:id/share), so both the endpoint and the
  // button depend on this profile's current state: "Create public link" only exists while it has
  // none. Re-running this spec against a local DB that wasn't reset finds the link from last time
  // instead — "↻ Regenerate" is the same POST, and it also re-enables a link this test disabled
  // at the end of its previous run (generateShare sets enabled: true).
  const shareButton = page.getByRole("button", { name: "Create public link" }).or(page.getByRole("button", { name: "↻ Regenerate" }));
  await expect(shareButton).toBeVisible();
  const [genRes] = await Promise.all([
    page.waitForResponse((r) => /\/api\/cv\/profiles\/\d+\/share$/.test(r.url()) && r.request().method() === "POST"),
    shareButton.click(),
  ]);
  expect(genRes.ok()).toBeTruthy();
  const share = (await genRes.json()) as { slug: string; enabled: boolean };

  const linkInput = page.getByLabel("Public CV link");
  await expect(linkInput).toHaveValue(new RegExp(`/cv/public/${share.slug}$`));

  // A brand-new, unauthenticated browser context — no cookies at all — is the whole point of a
  // public share link.
  const publicContext = await context.browser()!.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/cv/public/${share.slug}`);
  await expect(publicPage.getByText("Built with Zorya", { exact: false })).toBeVisible();
  await expect(publicPage.frameLocator("iframe[title='CV']").getByText("E2E Public CV Person")).toBeVisible();
  await publicContext.close();

  // A random/unknown slug never resolves to anyone's data.
  const wrongSlugRes = await page.request.get("/api/cv/public/this-slug-does-not-exist");
  expect(wrongSlugRes.status()).toBe(404);

  // Disabling it takes effect immediately, even though the slug itself is unchanged.
  const [disableRes] = await Promise.all([
    page.waitForResponse((r) => /\/api\/cv\/profiles\/\d+\/share$/.test(r.url()) && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Disable" }).click(),
  ]);
  expect(disableRes.ok()).toBeTruthy();

  const disabledRes = await page.request.get(`/api/cv/public/${share.slug}`);
  expect(disabledRes.status()).toBe(404);
});
