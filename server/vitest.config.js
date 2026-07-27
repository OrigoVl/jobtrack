import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Наразі без жорсткого порогу (`thresholds`) — репортимо, щоб бачити реальну
      // покривність, і піднімемо поріг окремо, коли числа стабілізуються.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
