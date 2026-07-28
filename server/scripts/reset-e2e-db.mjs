// Drops every app table from the e2e Postgres database before each local `pnpm test:e2e` run —
// the Postgres equivalent of the old `rm -f e2e/.tmp/e2e.db*` (SQLite file) reset. Uses DROP,
// not TRUNCATE, so it also works on the very first run (fresh docker-compose volume, tables
// don't exist yet). server/src/db/client.ts recreates the schema (migrate-on-boot) and
// server/src/db/bootstrap.ts reseeds the bootstrap user the moment the e2e server starts.
//
// Safe to run against CI's ephemeral Postgres service container too (nothing to drop there —
// this is a no-op if the tables don't exist), so the same script works locally and in CI.
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack";
const client = new pg.Client({ connectionString: url });

const TABLES = ["vacancy_status_history", "vacancies", "companies", "srs", "user_kv", "llm_cache"];

try {
  await client.connect();
  await client.query(`DROP TABLE IF EXISTS ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
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
