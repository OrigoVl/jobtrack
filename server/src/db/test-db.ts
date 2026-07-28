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
import type { UserId } from "./user-id.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "..", "..", "drizzle");

/** A fresh, empty, fully-migrated in-process Postgres — one per test file/suite, never shared. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/**
 * Every app table's `user_id` is a real FK to `user.id` (schema/auth.ts) — a repository test
 * inserting a vacancy/company/etc. for a given userId needs a matching `user` row to exist
 * first, or Postgres rejects the insert (correctly — this is the constraint actually doing its
 * job). Call once per test userId before exercising any repository against it.
 */
export async function insertTestUser(db: TestDb, id: UserId, email = `${id}@example.test`): Promise<void> {
  await db.insert(schema.user).values({ id, name: id, email });
}
