// Drops every app AND auth table from the e2e Postgres database before each local
// `pnpm test:e2e` run — the Postgres equivalent of the old `rm -f e2e/.tmp/e2e.db*` (SQLite
// file) reset. Uses DROP, not TRUNCATE, so it also works on the very first run (fresh
// docker-compose volume, tables don't exist yet). server/src/db/client.ts recreates the schema
// (migrate-on-boot) on the next server start. Auth tables (user/session/account/verification)
// MUST be included: without dropping `user`, e2e/auth.setup.ts's registration would fail on the
// second run with "email already exists" — the previous run's test user would still be there.
//
// Safe to run against CI's ephemeral Postgres service container too (nothing to drop there —
// this is a no-op if the tables don't exist), so the same script works locally and in CI.
import "dotenv/config";
import pg from "pg";

// Must match playwright.config.ts's own default — a SEPARATE database from the one `pnpm dev`
// uses, since every table listed below gets dropped.
const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack_e2e";
const client = new pg.Client({ connectionString: url });

// Every base table in `public` is discovered at runtime rather than listed here. A hardcoded
// list silently goes stale the moment a migration adds a table nobody remembers to add to it:
// the reset then drops the drizzle bookkeeping schema below but LEAVES that one table standing,
// so the next boot re-runs every migration from 0000 and dies on the forgotten table's own
// `CREATE TABLE ... already exists` — which surfaces as "Playwright could not start the
// webServer", pointing nowhere near the actual cause. Dropping tables one schema-query at a time
// rather than `DROP SCHEMA public CASCADE` deliberately: the pgvector extension lives in `public`
// too, and recreating it needs privileges this connection isn't guaranteed to have.
async function publicTables(c) {
  const { rows } = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  return rows.map((r) => r.tablename);
}

// An e2e server that's ALREADY listening is fatal, not something to work around: Playwright
// reuses it (webServer.reuseExistingServer, playwright.config.ts) instead of starting a fresh
// one, and only a fresh start re-applies the migrations this script is about to drop. Reusing a
// running server means the whole suite runs against an empty database — every spec fails on a
// missing relation, which reads like twenty unrelated app bugs rather than one stale process.
// Checked BEFORE dropping anything, so the recovery is just "stop that server and re-run".
const E2E_PORT = process.env.PORT || 4173;
const alreadyRunning = await fetch(`http://127.0.0.1:${E2E_PORT}/api/health`)
  .then(() => true)
  .catch(() => false);
if (alreadyRunning) {
  console.error(
    `❌ Something is already serving http://127.0.0.1:${E2E_PORT} — stop it and re-run.\n` +
      `   Playwright would reuse that process instead of starting a fresh one, and it would never\n` +
      `   re-apply the migrations this reset drops, so every spec would run against an empty DB.`,
  );
  process.exit(1);
}

try {
  await client.connect();
  const tables = await publicTables(client);
  // One statement with every table listed, not a loop: CASCADE across a graph of foreign keys
  // makes the drop order matter otherwise.
  if (tables.length) await client.query(`DROP TABLE IF EXISTS ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
  // Drizzle records applied migrations in its own "drizzle" schema (separate from the app's
  // "public" schema, so it survives the DROP TABLEs above). Without dropping it too, the next
  // boot's migrate-on-boot (server/src/db/client.ts) sees migration 0000's hash already
  // recorded and skips re-running it — leaving the just-dropped tables missing instead of
  // recreated, and the e2e server crashes on the first query ("relation ... does not exist").
  await client.query(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  console.log(`✅ e2e DB reset (${url})`);
} catch (e) {
  console.error(`❌ Could not reset the e2e DB at ${url} — is Postgres running? (docker compose up -d postgres)`, e);
  process.exit(1);
} finally {
  await client.end();
}
