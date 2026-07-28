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
      // Baseline thresholds, pinned to the current real coverage (49.88/69.46/47.56/49.88%)
      // with a small margin — this is a regression gate ("don't drop below what's already
      // there"), not a target for that exact percentage. Many *.routes.ts files stay at 0%
      // (covered only by E2E/manual CURL, not unit tests) — a deliberate choice: unit-testing
      // thin routes has little value, so unit coverage focuses on services/validation with
      // real logic.
      thresholds: {
        statements: 45,
        branches: 65,
        functions: 42,
        lines: 45,
      },
    },
  },
});
