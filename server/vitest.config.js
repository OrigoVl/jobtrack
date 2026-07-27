import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      // Baseline-пороги, зафіксовані від поточної реальної покривності з невеликим запасом —
      // це regression-гейт ("не впади нижче того, що вже є"), а не мета саме такого відсотка.
      // Багато *.routes.ts лишаються 0% (покриті лише E2E/ручним CURL, не юніт-тестами) —
      // свідомий вибір: тонкі роути тестувати юніт-тестами малоцінно, юніт-покриття фокусується
      // на сервісах/валідації з реальною логікою.
      //
      // Vitest 4 (dev-dependencies bump) переключив V8-провайдер coverage на AST-aware
      // remapping (раніше experimentalAstAwareRemapping, тепер дефолт замість старого
      // v8-to-istanbul) — він ТОЧНІШИЙ за попередній, тож числа branches/functions впали не
      // через регресію тестів (усі 186 тестів так само зелені), а через коректніше вимірювання.
      // Пороги перекалібровано під нову реальну базу (40.25/35.55/38.21/40.45%).
      thresholds: {
        statements: 38,
        branches: 33,
        functions: 36,
        lines: 38,
      },
    },
  },
});
