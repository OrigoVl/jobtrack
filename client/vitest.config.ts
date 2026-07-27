import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/test/**"],
      // Baseline-пороги від поточної реальної покривності з невеликим запасом — regression-гейт,
      // а не мета. Statements/lines навмисно низькі: юніт-тести покривають лише shared/queries/*
      // (хуки мутацій з оптимістичними оновленнями), а не UI компоненти (*.tsx сторінки) — їх
      // покривають ключові флоу в e2e/ (Playwright), не vitest.
      //
      // Vitest 4 (dev-dependencies bump) переключив V8-провайдер coverage на AST-aware remapping
      // (раніше experimentalAstAwareRemapping, тепер дефолт замість старого v8-to-istanbul) —
      // він ТОЧНІШИЙ за попередній, тож числа branches/functions впали не через регресію тестів
      // (усі 19 тестів так само зелені), а через коректніше вимірювання. Пороги перекалібровано
      // під нову реальну базу (7.91/5.73/7.08/8.14%).
      thresholds: {
        statements: 7,
        branches: 5,
        functions: 6,
        lines: 7,
      },
    },
  },
});
