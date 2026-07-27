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
      // Baseline-пороги від поточної реальної покривності (4.39/46.98/36.11/4.39%) з невеликим
      // запасом — regression-гейт, а не мета. Statements/lines навмисно низькі: юніт-тести
      // покривають лише shared/queries/* (хуки мутацій з оптимістичними оновленнями), а не UI
      // компоненти (*.tsx сторінки) — їх покривають ключові флоу в e2e/ (Playwright), не vitest.
      thresholds: {
        statements: 4,
        branches: 42,
        functions: 32,
        lines: 4,
      },
    },
  },
});
