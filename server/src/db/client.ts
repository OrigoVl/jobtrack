// Postgres connection (node-postgres pool) + Drizzle instance + migrate-on-boot. This is the
// only place where `new pg.Pool(...)` happens — the rest of the code works through this
// module's default export (a Drizzle instance) or through the helpers in db/kv.ts.
//
// Migrations run as a top-level await: the import of this module (and therefore of anything
// that transitively imports it — app.ts, routes.ts) doesn't resolve until the schema is
// up to date, so `server/src/index.ts` never calls `app.listen()` against a stale schema.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { fileURLToPath } from "url";
import path from "path";
import { env } from "../config/env.js";
import { contextLogger } from "../core/logger.js";
import * as schema from "./schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/db/client.ts -> server/drizzle (the migrations folder drizzle-kit generates into,
// see server/drizzle.config.ts) — resolved relative to this file, not process.cwd(), so it
// works the same whether the app is started from server/ or the repo root.
const migrationsFolder = path.join(__dirname, "..", "..", "drizzle");

const pool = new pg.Pool({ connectionString: env.db.url, max: env.db.poolMax });

export const db = drizzle(pool, { schema });
export type AppDb = typeof db;

if (env.db.migrateOnBoot) {
  await migrate(db, { migrationsFolder });
}

/** Lightweight check that the DB connection is alive and can run a query (for /api/health). */
export async function pingDb(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (e) {
    // /api/health only shows {ok:false} — without this log, the reason the DB check failed
    // (connection refused, auth failure, network partition) would stay unknown until manually reproduced.
    contextLogger().error({ err: e }, "Database health check failed");
    return false;
  }
}

/** Closes the connection pool — called on graceful shutdown. */
export async function closeDb(): Promise<void> {
  await pool.end();
}

/** Runs `fn` only if this process wins a Postgres advisory lock for `lockKey` — used by
 * schedulers (digest/saved-searches) so that with multiple server replicas each running the same
 * `setInterval`, only one replica actually executes a given tick; the rest skip it instead of
 * duplicating the work (duplicate emails/Telegram alerts — see digest.scheduler.ts/
 * saved-searches.scheduler.ts). Transaction-scoped (`pg_try_advisory_xact_lock`, not the
 * session-scoped `pg_advisory_lock`): the lock is released automatically when the transaction
 * ends (COMMIT/ROLLBACK, or the connection dropping), so there's no separate unlock call to
 * forget — even if the process crashes mid-run, the lock can't leak. Goes through Drizzle's
 * `transaction()` (not a raw `pool.connect()`) so the SQL itself works unchanged against either
 * driver this module could be backed by. Holds one pooled connection for the whole duration of
 * `fn` (which can be several minutes for a full digest run over every user) — acceptable for a
 * job that only runs every few hours against a pool sized in the tens of connections. Returns
 * whether `fn` actually ran (false = another replica already holds this tick's lock).
 *
 * `testDb` exists ONLY for db/client.test.ts: this function is defined in the same module as the
 * real `db`/`pool` it defaults to, and that module runs `await migrate(...)` against a real
 * Postgres at import time — unlike every other db/*.ts and *.repo.ts module (which import `db`
 * from here and so can swap it via `vi.doMock(".../client.js", () => ({ default: testDb }))`,
 * see test-db.ts), this file can't mock itself that way. Injecting a PGlite-backed Drizzle
 * instance (`createTestDb()`) directly is the only way to unit-test this function's SQL without
 * a real reachable Postgres (see ci.yml's build-and-test job, which never runs one). Typed as the
 * generic `PgDatabase<PgQueryResultHKT, ...>` base (not the concrete `AppDb`/`NodePgDatabase`)
 * specifically so a `PgliteDatabase` is assignable here. Real call sites (the two schedulers)
 * never pass this — they get the real `db`. */
export async function withAdvisoryLock(
  lockKey: number,
  fn: () => Promise<void>,
  testDb: PgDatabase<PgQueryResultHKT, typeof schema> = db,
): Promise<boolean> {
  return testDb.transaction(async (tx) => {
    // `testDb`'s generic PgDatabase<PgQueryResultHKT, ...> type (needed so both the real
    // NodePgDatabase and, in tests, a PGliteDatabase are assignable — see this parameter's own
    // doc comment above) can't express the concrete node-postgres/PGlite `{ rows: T[] }` result
    // shape `execute()` actually returns at runtime; cast rather than lose that generic bound.
    const result = (await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${lockKey}) AS locked`)) as { rows: { locked: boolean }[] };
    const locked = result.rows[0]?.locked === true;
    if (locked) await fn();
    return locked;
  });
}

export default db;
