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
      // Baseline thresholds from actual current coverage (10.12/64.72/32.55/10.12%, Phase 8) with
      // a small buffer — a regression gate, not a target. Statements/lines are intentionally low:
      // unit tests cover shared/queries/* (mutation hooks with optimistic updates) and other pure
      // logic (shared/*.ts, auth/401-handling), not UI components (*.tsx pages) — those are
      // covered by key flows in e2e/ (Playwright), not vitest.
      thresholds: {
        statements: 9,
        branches: 60,
        functions: 30,
        lines: 9,
      },
    },
  },
});
