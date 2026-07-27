// Підключення до SQLite (вбудований node:sqlite) + схема + первинний сід порожньої БД.
// Це єдине місце, де відбувається `new DatabaseSync(...)` — решта коду працює через
// default-експорт цього модуля або через хелпери з db/kv.ts.
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
  status TEXT DEFAULT 'Хочу подати', fit TEXT DEFAULT 'med',
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

// Міграція: додає колонку, якщо її ще немає в існуючій БД. SQLite не підтримує
// "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" (на відміну від Postgres), тож перевіряємо
// наявність колонки вручну через PRAGMA table_info — інакше повторний запуск на вже
// змігрованій БД впав би з "duplicate column name".
function addColumnIfMissing(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// FSRS (замінив спрощений SM-2, що жив лише на ease/interval) потребує difficulty/stability
// (D/S — два з трьох компонентів моделі пам'яті FSRS) і дату останнього огляду (щоб рахувати
// elapsed days для retrievability). Старі колонки ease/interval лишаються в таблиці (не
// видаляємо — SQLite ALTER TABLE DROP COLUMN вимагає повного перестворення таблиці, а сенсу
// це виправдовує лише для великих таблиц) і просто більше не читаються новим кодом планування.
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
    insert.run(company, position, level, url, "Відправив CV", fit, JSON.stringify(stack));
  }
}

// Бекфіл історії статусів для вакансій, створених до появи vacancy_status_history
// (сідові дані чи старі рядки БД) — інакше "скільки вакансій колись досягли етапу X"
// в аналітиці був би порожнім для всього, що існувало на момент цієї міграції.
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

/** Легка перевірка, що з'єднання з БД живе й може виконати запит (для /api/health). */
export function pingDb(): boolean {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch (e) {
    // /api/health показує лише {ok:false} — без цього логу причина падіння БД (locked file,
    // permission, disk full, corruption) лишилась би невідомою до ручного відтворення.
    contextLogger().error({ err: e }, "Database health check failed");
    return false;
  }
}

/** Закриває з'єднання з SQLite (WAL checkpoint + звільнення файлу) — викликається при graceful shutdown. */
export function closeDb(): void {
  db.close();
}

export default db;
