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
      // Baseline-пороги, зафіксовані від поточної реальної покривності (49.88/69.46/47.56/49.88%)
      // з невеликим запасом — це regression-гейт ("не впади нижче того, що вже є"), а не мета
      // саме такого відсотка. Багато *.routes.ts лишаються 0% (покриті лише E2E/ручним CURL,
      // не юніт-тестами) — свідомий вибір: тонкі роути тестувати юніт-тестами малоцінно,
      // юніт-покриття фокусується на сервісах/валідації з реальною логікою.
      thresholds: {
        statements: 45,
        branches: 65,
        functions: 42,
        lines: 45,
      },
    },
  },
});
