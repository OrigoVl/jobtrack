import { test, expect } from "@playwright/test";

/**
 * "🧪 JS sandbox" (features/study/runner.ts) runs arbitrary code in a Web Worker (not on the
 * main thread, as it used to) — we check the real browser execution path here. The
 * timeout/kill of an infinite loop (the most important part of the contract) is checked
 * SEPARATELY by a unit test with fake timers and a mock Worker (src/features/study/runner.test.ts)
 * — a real busy-loop in an actual Worker overloads the CPU so much that in CI/sandboxed
 * environments with few cores even click() hangs BEFORE the loop starts (competing for the
 * same Chromium process), which would make an e2e test like this non-deterministic depending
 * on the runner's hardware.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/study");
  await page.getByRole("button", { name: "⌨️ Drill" }).click();
  // Static drill problems in the "JavaScript" category have a runnable sandbox block (RUNNABLE_CATS).
  await page.locator("select").first().selectOption("JavaScript");
  await page.getByRole("button", { name: /Open sandbox/ }).click();
});

test("runs normal code in a real Worker (not eval on the main thread) and shows console.log output", async ({ page }) => {
  const textarea = page.locator("textarea");
  await textarea.fill("console.log(1 + 1);");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByText("2", { exact: true })).toBeVisible();
});

test("surfaces a runtime error from the sandboxed code without crashing the page", async ({ page }) => {
  const textarea = page.locator("textarea");
  await textarea.fill("throw new Error('boom');");
  await page.getByRole("button", { name: "▶ Run" }).click();
  await expect(page.getByText(/Error: boom/)).toBeVisible();
  // The page stays alive and interactive after an error in the sandbox.
  await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();
});
