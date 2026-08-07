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
      // Baseline thresholds from actual current coverage (17.82/14.38/14.02/17.73%) with a small
      // buffer — a regression gate, not a target. All four are intentionally low: unit tests
      // cover shared/queries/* (mutation hooks with optimistic updates) and other pure logic
      // (shared/*.ts, auth/401-handling), not UI components (*.tsx pages) — those are covered by
      // key flows in e2e/ (Playwright), not vitest.
      //
      // The branches/functions numbers here used to read 60/30, from a baseline (64.72/32.55)
      // that can only have been measured over the files unit tests actually import. The report
      // now spans every file matched by `include` above, so the ~135-of-181 that no unit test
      // touches all count as 0% and drag both averages down — `pnpm test:coverage` failed those
      // two thresholds on a clean checkout, with no test deleted and nothing regressed. The
      // numbers here are what the gate actually measures; moving them up is a matter of
      // unit-testing more modules, not of editing these constants.
      thresholds: {
        statements: 17,
        branches: 14,
        functions: 13,
        lines: 17,
      },
    },
  },
});
