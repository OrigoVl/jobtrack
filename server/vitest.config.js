import os from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // 21 of these suites boot their OWN in-process Postgres in a `beforeAll` (PGlite — see
    // src/db/test-db.ts), which is far heavier to start than a normal unit test. Vitest's default
    // pool is one worker per core, so on a many-core machine a dozen WASM Postgres instances try
    // to initialize at the same moment and starve each other past `createTestDb()`'s hook
    // timeout: a different random handful of suites fails on every run, always as "Hook timed out
    // in Nms" and never as an assertion — which reads exactly like a real regression until you
    // notice the failing set never repeats and each of them passes on its own. Capping the pool
    // makes the suite deterministic, for a few seconds of wall time. Deliberately a cap, not a
    // fixed number — a 2-core CI runner shouldn't be forced up to 4.
    maxWorkers: Math.max(2, Math.min(4, os.cpus().length)),
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
