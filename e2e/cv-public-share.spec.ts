import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the shareable public CV link: generate it from the CV Builder, confirm the
 * PUBLIC page (no session at all — a fresh, unauthenticated browser context) renders the real
 * doc content, then confirm disabling it takes the link down immediately.
 */
test("generates a public CV link, viewable without any session, and disables cleanly", async ({ page, context }) => {
  // Seeds distinctive content directly via the real API (not the focus of this test, which is
  // the share-link flow, not the CV Builder's own field-editing UI — already covered by other
  // cv-builder-*.spec.ts files).
  const seedRes = await page.request.put("/api/cv/doc", {
    data: { name: "E2E Public CV Person", title: "E2E Test Engineer" },
  });
  expect(seedRes.ok()).toBeTruthy();

  await page.goto("/cvbuilder");

  const [genRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cv/share") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Create public link" }).click(),
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
  await expect(publicPage.getByText("Built with DevRadar", { exact: false })).toBeVisible();
  await expect(publicPage.frameLocator("iframe[title='CV']").getByText("E2E Public CV Person")).toBeVisible();
  await publicContext.close();

  // A random/unknown slug never resolves to anyone's data.
  const wrongSlugRes = await page.request.get("/api/cv/public/this-slug-does-not-exist");
  expect(wrongSlugRes.status()).toBe(404);

  // Disabling it takes effect immediately, even though the slug itself is unchanged.
  const [disableRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cv/share") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Disable" }).click(),
  ]);
  expect(disableRes.ok()).toBeTruthy();

  const disabledRes = await page.request.get(`/api/cv/public/${share.slug}`);
  expect(disabledRes.status()).toBe(404);
});
