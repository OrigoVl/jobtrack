// PGlite-backed Drizzle instance for repository integration tests — a real (in-process, WASM)
// Postgres, no Docker/network required. Applies the same generated migration SQL
// (server/drizzle/*.sql) that the real app runs, so a test exercises the actual schema
// (composite keys, ON CONFLICT targets, etc.), not a hand-rolled approximation of it.
//
// Repository modules (kv.ts, companies.repo.ts, vacancies.repo.ts, vacancy-history.ts) all
// import their `db` from "./client.js" — a test that needs REAL query behavior (not the
// lightweight `vi.mock` stubs used elsewhere) replaces that import with the instance this file
// returns via `vi.doMock("<path-to>/client.js", () => ({ default: testDb }))` BEFORE a dynamic
// `import()` of the repository module under test (see companies.repo.test.ts).
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "url";
import path from "path";
import * as schema from "./schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "..", "..", "drizzle");

/** A fresh, empty, fully-migrated in-process Postgres — one per test file/suite, never shared. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}
