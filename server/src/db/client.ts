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

export default db;
