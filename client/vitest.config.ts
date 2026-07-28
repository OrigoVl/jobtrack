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
      // Baseline thresholds from actual current coverage (4.39/46.98/36.11/4.39%) with a small
      // buffer — a regression gate, not a target. Statements/lines are intentionally low: unit
      // tests only cover shared/queries/* (mutation hooks with optimistic updates), not UI
      // components (*.tsx pages) — those are covered by key flows in e2e/ (Playwright), not vitest.
      thresholds: {
        statements: 4,
        branches: 42,
        functions: 32,
        lines: 4,
      },
    },
  },
});
