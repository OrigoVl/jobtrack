// SQLite connection (built-in node:sqlite) + schema + initial seed for an empty DB.
// This is the only place where `new DatabaseSync(...)` happens — the rest of the code
// works through this module's default export or through the helpers in db/kv.ts.
import { DatabaseSync } from "node:sqlite";
import { env } from "../config/env.js";
import { contextLogger } from "../core/logger.js";
import { DEFAULT_PROFILE, SEED_VACANCIES } from "./seed-vacancies.js";

const db = new DatabaseSync(env.dbPath);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS vacancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT, position TEXT, level TEXT, url TEXT,
  status TEXT DEFAULT 'Want to apply', fit TEXT DEFAULT 'med',
  applied TEXT, next TEXT, notes TEXT, stack TEXT DEFAULT '[]',
  created TEXT DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE, notes TEXT DEFAULT '', questions TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS srs (
  cardId TEXT PRIMARY KEY, ease REAL DEFAULT 2.5, interval INTEGER DEFAULT 0,
  due TEXT DEFAULT (date('now')), reps INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kv ( k TEXT PRIMARY KEY, v TEXT );
CREATE TABLE IF NOT EXISTS vacancy_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vacancy_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  changed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vacancy_status_history_vacancy ON vacancy_status_history(vacancy_id);
`);

// Migration: adds a column if it isn't already present in an existing DB. SQLite doesn't
// support "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" (unlike Postgres), so we check for the
// column manually via PRAGMA table_info — otherwise re-running on an already-migrated DB
// would fail with "duplicate column name".
function addColumnIfMissing(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// FSRS (replaced the simplified SM-2 that lived solely on ease/interval) needs
// difficulty/stability (D/S — two of the three components of the FSRS memory model) and the
// date of the last review (to compute elapsed days for retrievability). The old ease/interval
// columns stay in the table (not dropped — SQLite's ALTER TABLE DROP COLUMN requires a full
// table rebuild, only worth it for large tables) and are simply no longer read by the new
// scheduling code.
addColumnIfMissing("srs", "difficulty", "difficulty REAL");
addColumnIfMissing("srs", "stability", "stability REAL");
addColumnIfMissing("srs", "lastReview", "lastReview TEXT");

function seedProfileIfEmpty(): void {
  if (!db.prepare("SELECT v FROM kv WHERE k='profile'").get()) {
    db.prepare("INSERT INTO kv (k,v) VALUES ('profile', ?)").run(JSON.stringify(DEFAULT_PROFILE));
  }
}

function seedVacanciesIfEmpty(): void {
  const { c } = db.prepare("SELECT COUNT(*) c FROM vacancies").get() as { c: number };
  if (Number(c) > 0) return;
  const insert = db.prepare("INSERT INTO vacancies (company,position,level,url,status,fit,stack) VALUES (?,?,?,?,?,?,?)");
  for (const [company, position, level, url, fit, stack] of SEED_VACANCIES) {
    insert.run(company, position, level, url, "Applied", fit, JSON.stringify(stack));
  }
}

// Backfills status history for vacancies created before vacancy_status_history existed
// (seed data or old DB rows) — otherwise "how many vacancies ever reached stage X" in the
// analytics would be empty for everything that existed at the time of this migration.
function backfillStatusHistory(): void {
  const rows = db
    .prepare(
      `SELECT v.id, v.status FROM vacancies v
       LEFT JOIN vacancy_status_history h ON h.vacancy_id = v.id
       WHERE h.id IS NULL`,
    )
    .all() as { id: number; status: string }[];
  const insert = db.prepare("INSERT INTO vacancy_status_history (vacancy_id, status) VALUES (?, ?)");
  for (const row of rows) insert.run(row.id, row.status);
}

seedProfileIfEmpty();
seedVacanciesIfEmpty();
backfillStatusHistory();

/** Lightweight check that the DB connection is alive and can run a query (for /api/health). */
export function pingDb(): boolean {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch (e) {
    // /api/health only shows {ok:false} — without this log, the reason the DB check failed
    // (locked file, permission, disk full, corruption) would stay unknown until manually reproduced.
    contextLogger().error({ err: e }, "Database health check failed");
    return false;
  }
}

/** Closes the SQLite connection (WAL checkpoint + releases the file) — called on graceful shutdown. */
export function closeDb(): void {
  db.close();
}

export default db;
