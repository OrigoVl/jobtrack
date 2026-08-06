import { test, expect } from "@playwright/test";

/**
 * End-to-end test of the CV Builder's preview panel (features/cv/builder/cv-preview-panel.tsx):
 * the page-count badge and the fullscreen mode.
 *
 * The fullscreen modal is deliberately checked via E2E (not a unit test): at one point
 * (before a fix in index.css) it needed to be pixel-perfectly positioned relative to the real
 * `position: fixed` viewport, but a global CSS animation on `main > *` with
 * `animation-fill-mode: both` (the transform stayed in the computed style even after the
 * animation finished) turned the direct child of <main> into the containing block for fixed
 * descendants — the modal rendered relative to the page content instead of the viewport, and
 * didn't cover the sidebar. jsdom/vitest doesn't render a real layout/CSS cascade, so a
 * regression like this is invisible without a real browser.
 */
test("CV preview shows a page-count badge and opens/closes a real fullscreen overlay", async ({ page }) => {
  await page.goto("/cvbuilder");

  const badge = page.getByTitle(/pages when printed to PDF/);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/Page \d+ \/ \d+$/);

  // Accessible name now comes from the button's `title` attribute (its content is an icon-only
  // ExpandIcon SVG, no text) — "Fullscreen" (cv.json's preview.fullscreen), not the old "⛶" glyph.
  const openFullscreen = page.getByRole("button", { name: "Fullscreen" });
  await openFullscreen.click();

  const modalHeading = page.getByText("CV preview", { exact: true });
  await expect(modalHeading).toBeVisible();

  // A real fixed modal — position:fixed relative to the viewport, not some scrolled ancestor of
  // the page: the bounding box should start close to viewport (0,0), not somewhere in the
  // middle of a long page's content (exactly how the bug described above looked).
  const overlay = page.locator("div.fixed.inset-0.z-50");
  const box = await overlay.boundingBox();
  // A "real" fixed modal stretches across the whole viewport (inset-0) regardless of page
  // scroll — the tolerance is small (e.g. a possible scrollbar), but before the fix the top
  // edge ended up hundreds of pixels lower (wherever the page scroll happened to stop).
  expect(box?.x).toBeLessThan(20);
  expect(box?.y).toBeLessThan(20);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(modalHeading).not.toBeVisible();
});

/**
 * Layout regression: the preview used to be in the same sticky column AFTER the
 * Appearance/Presets panels ("preview at the bottom right" — a user complaint), so we check
 * that it's always first and visible immediately, regardless of which accordion section
 * ("General"/"Design") is open on the left.
 *
 * The second part is a CSS Grid "blowout" regression: the preview iframe renders at a fixed
 * "page" width of 880px (PAGE_WIDTH in cv-preview-panel.tsx) and is only visually scaled via a
 * transform. Without an explicit `grid-cols-1` (Tailwind sets `minmax(0,1fr)`) instead of an
 * implicit single-column grid (track sizing "auto", which accounts for descendants' min-content),
 * that fixed width would stretch the ENTIRE mobile page into horizontal scroll —
 * jsdom/vitest doesn't render a real layout, so a bug like this is invisible without a real browser.
 */
test("preview column stays visible-first across tabs and never causes horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cvbuilder");

  const noHorizontalOverflow = async () => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  };
  await noHorizontalOverflow();

  // Only one accordion section is open at a time now (see cv-builder.tsx) — "Design" replaces
  // the old "Design" tab, and opening it reveals a nested "Template · …" sub-section.
  await page.getByRole("button", { name: /^Design/ }).click();
  await expect(page.getByRole("button", { name: /^Template ·/ })).toBeVisible();
  await noHorizontalOverflow();

  await page.getByRole("button", { name: /^General/ }).click();
  await expect(page.getByText("Summary", { exact: true })).toBeVisible();
  await noHorizontalOverflow();
});
