import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_PATH = path.join(__dirname, "fixtures", "resume.txt");

/**
 * Наскрізний тест ключового флоу: завантаження CV-файлу → сервер витягує текст і
 * навички → застосунок застосовує їх у профілі (features/cv/cv.tsx -> POST /api/cv/upload).
 */
test("uploads a CV file and applies extracted text/skills", async ({ page }) => {
  await page.goto("/cv");

  await page.locator('input[type="file"]').setInputFiles(RESUME_PATH);

  await expect(page.getByText(/CV застосовано всюди/)).toBeVisible({ timeout: 15_000 });

  // Витягнутий текст резюме має зʼявитись у полі CV на сторінці.
  await expect(page.getByLabel("Текст CV (можна редагувати або вставити вручну)")).toHaveValue(/Full Stack Developer/);
});
