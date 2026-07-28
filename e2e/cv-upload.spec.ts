import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_PATH = path.join(__dirname, "fixtures", "resume.txt");

/**
 * End-to-end test of a key flow: uploading a CV file → the server extracts text and
 * skills → the app applies them to the profile (features/cv/cv.tsx -> POST /api/cv/upload).
 */
test("uploads a CV file and applies extracted text/skills", async ({ page }) => {
  await page.goto("/cv");

  await page.locator('input[type="file"]').setInputFiles(RESUME_PATH);

  await expect(page.getByText(/CV applied everywhere/)).toBeVisible({ timeout: 15_000 });

  // The extracted resume text should show up in the CV field on the page.
  await expect(page.getByLabel("CV text (you can edit or paste manually)")).toHaveValue(/Full Stack Developer/);
});
