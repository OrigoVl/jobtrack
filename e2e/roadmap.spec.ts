import { test, expect } from "@playwright/test";

/**
 * Наскрізний тест ключового флоу: клік по кружечку статусу навички в Роудмапі циклічно
 * міняє статус (не почато → вчу → знаю → не почато) і зберігає його на бекенді
 * (features/roadmap/roadmap.tsx -> POST /api/roadmap/status).
 *
 * Прив'язуємось до КОНКРЕТНОЇ навички за назвою (а не до "першого" вузла за позицією):
 * порядок вузлів у групі сортується за попитом (demand), який може змінитись між кроками
 * цього тесту через інші E2E-специфікації, що паралельно додають вакансії (спільна БД
 * для всіх тестів у прогоні) — позиційний локатор був би нестабільним після reload.
 */
test("toggles a roadmap node status and persists it across reload", async ({ page }) => {
  await page.goto("/roadmap");

  const nodeCard = page.locator("div.relative.pl-8").first();
  await expect(nodeCard).toBeVisible();
  const techName = (await nodeCard.locator("span.font-semibold").first().textContent())?.trim() ?? "";
  expect(techName).not.toBe("");

  const statusButton = nodeCard.locator('button[title^="Клік — змінити статус"]');
  const before = await statusButton.textContent();
  // Мутація оптимістична (UI оновлюється миттєво, до відповіді сервера) — чекаємо саме
  // на мережеву відповідь PUT /api/roadmap/progress, інакше reload() нижче може перервати
  // ще не завершений запит, і сервер так і не збереже зміну (флейкі тест).
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/roadmap/progress") && res.request().method() === "PUT"),
    statusButton.click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(statusButton).not.toHaveText(before ?? "");
  const after = await statusButton.textContent();

  await page.reload();

  const nodeCardAfterReload = page.locator("div.relative.pl-8").filter({ has: page.getByText(techName, { exact: true }) });
  await expect(nodeCardAfterReload.locator('button[title^="Клік — змінити статус"]')).toHaveText(after ?? "");
});
