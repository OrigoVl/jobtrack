// drizzle-kit config: `pnpm --filter jobtrack-server exec drizzle-kit generate` produces reviewable
// SQL migration files under drizzle/ (committed to git) — this project uses generate+migrate,
// never `drizzle-kit push`, so every schema change has a diffable SQL file in PR review.
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Reads process.env directly — the one deliberate exception to "never read process.env outside
// config/env.ts": this file is the drizzle-kit CLI's own entry point, run standalone outside the
// app's module graph, so config/env.ts's Zod validation doesn't apply here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack",
  },
});
