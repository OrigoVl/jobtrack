import { test, expect } from "@playwright/test";

/**
 * Регресія: кнопки AI-дій у Конструкторі CV раніше лише міняли текст на "…" замість справжнього
 * анімованого спінера (`Btn loading` -> `<Spinner>` з `animate-spin`) — користувач повідомив, що
 * не розуміє, чи йде процес, бо зміна тексту непомітна. Тепер `loading` показує SVG-іконку.
 *
 * У реальному використанні з увімкненим LLM-ключем запит займає секунди — досить, щоб побачити
 * спінер. У E2E LLM свідомо офлайн (детермінізм, playwright.config.ts) — офлайн-аналіз відповідає
 * майже миттєво, тож звичний клік не встигає "зловити" проміжний стан. Штучно затримуємо саме цей
 * запит через `page.route()`, щоб перевірити спінер детерміновано, а не покладатись на випадковий
 * таймінг реальної мережі.
 */
test("AI-analysis button shows a real animated spinner (not just text swap) while the request is in flight", async ({ page }) => {
  let releaseResponse: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/cv/review", async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/cvbuilder");
  const btn = page.getByRole("button", { name: "🔎 Поради" });
  await expect(btn).toBeVisible();
  await btn.click();

  const spinner = btn.locator("svg.animate-spin");
  await expect(spinner).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute("aria-busy", "true");

  releaseResponse?.();
  await expect(spinner).not.toBeVisible();
  await expect(btn).toBeEnabled();
});
