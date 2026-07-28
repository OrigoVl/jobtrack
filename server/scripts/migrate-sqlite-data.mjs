// One-time migration: your personal data in the old node:sqlite file (server/jobtrack.db) →
// Postgres, as BOOTSTRAP_USER_ID's rows (server/src/db/user-id.ts). Read-only against SQLite
// (opened with `readOnly: true` — a second layer of protection on top of "this script never
// calls .exec()/.run()"), so there is no way this script can corrupt your original data.
//
// Run this BEFORE ever starting the app against a fresh Postgres: server/src/db/bootstrap.ts
// seeds sample data the moment the server starts IF the bootstrap user has no vacancies yet —
// run this script first and that sample-seeding step becomes a no-op (the user already has data).
//
// Usage:
//   node server/scripts/migrate-sqlite-data.mjs --dry-run   # preview counts only, no writes
//   node server/scripts/migrate-sqlite-data.mjs             # actually migrate
//   node server/scripts/migrate-sqlite-data.mjs --force     # migrate even if Postgres already
//                                                            # has vacancies for this user
//                                                            # (WILL duplicate rows — only use
//                                                            # this if you know what you're doing)
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.join(__dirname, "..", "jobtrack.db");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const BOOTSTRAP_USER_ID = "bootstrap-user";

// The canonical Ukrainian → English status mapping used across the whole app's translation —
// old SQLite files predate that translation and still carry the Ukrainian values.
const STATUS_TRANSLATION = {
  "Хочу подати": "Want to apply",
  "Відправив CV": "Applied",
  Скринінг: "Screening",
  "Тех.співбесіда": "Tech interview",
  "Тестове завдання": "Take-home task",
  Фінал: "Final",
  Оффер: "Offer",
  Відмова: "Rejected",
  Пауза: "Paused",
};
function translateStatus(status) {
  return STATUS_TRANSLATION[status] ?? status;
}

const log = (...args) => console.log(...args);

let sqlite;
try {
  sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
} catch (e) {
  log(`No SQLite file found at ${sqlitePath} (or it's unreadable) — nothing to migrate.`, e.message);
  process.exit(0);
}

const vacancies = sqlite.prepare("SELECT * FROM vacancies").all();
const companies = sqlite.prepare("SELECT * FROM companies").all();
const srsRows = sqlite.prepare("SELECT * FROM srs").all();
const kvRows = sqlite.prepare("SELECT * FROM kv").all();
const historyRows = sqlite.prepare("SELECT * FROM vacancy_status_history").all();

// Caches (llm:/embedding:/skx:/domain: content hashes, kb: derived-skill-hash) are disposable —
// they regenerate on the next request — and their djb2 hash-based keys are exactly the format
// phase 4's SHA-256 upgrade replaces anyway, so they're deliberately NOT migrated. `profile` and
// `cvDoc` are real user data (not a cache) and ARE migrated.
const KV_MIGRATE_KEYS = new Set(["profile", "cvDoc"]);
const kvToMigrate = kvRows.filter((r) => KV_MIGRATE_KEYS.has(r.k));
const kvSkipped = kvRows.length - kvToMigrate.length;

log("Found in SQLite:");
log(`  vacancies:              ${vacancies.length}`);
log(`  companies:              ${companies.length}`);
log(`  srs (flashcard reviews): ${srsRows.length}`);
log(`  kv entries:             ${kvToMigrate.length} to migrate (profile/cvDoc), ${kvSkipped} disposable caches skipped`);
log(`  status history rows:    ${historyRows.length}`);

if (dryRun) {
  log("\n--dry-run: no writes made. Re-run without --dry-run to actually migrate.");
  process.exit(0);
}

const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack";

// Wrapped in a function (not a top-level try/catch): this is an ES module, so a top-level
// `return` isn't syntactically valid, and process.exit() inside a try/catch would skip its
// finally block — the Postgres connection would stay open (a resource leak) on an early exit or
// error. process.exitCode + a `return` from inside the function means the finally (client.end())
// always runs.
async function migrate() {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();

    // `bootstrap-user` was never a real row in better-auth's `user` table — every app table's
    // user_id is a real FK to it (schema/app.ts), so a placeholder row is required before any of
    // the inserts below can succeed. claim-bootstrap-data.mjs deletes this placeholder once its
    // data has been reassigned to a real registered account.
    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, 'Bootstrap (unclaimed)', 'bootstrap-user@local.invalid', false)
       ON CONFLICT (id) DO NOTHING`,
      [BOOTSTRAP_USER_ID],
    );

    const {
      rows: [{ c: existingVacancies }],
    } = await client.query("SELECT COUNT(*) c FROM vacancies WHERE user_id = $1", [BOOTSTRAP_USER_ID]);
    if (Number(existingVacancies) > 0 && !force) {
      log(
        `\n❌ Postgres already has ${existingVacancies} vacancies for ${BOOTSTRAP_USER_ID} — ` +
          `aborting to avoid duplicating data. Pass --force to migrate anyway (this WILL create duplicates).`,
      );
      process.exitCode = 1;
      return;
    }

    await client.query("BEGIN");

    const vacancyIdMap = new Map(); // old SQLite id -> new Postgres id
    for (const v of vacancies) {
      const {
        rows: [{ id: newId }],
      } = await client.query(
        `INSERT INTO vacancies (user_id, company, position, level, url, status, fit, applied, next, notes, stack, created)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          BOOTSTRAP_USER_ID,
          v.company ?? "",
          v.position ?? "",
          v.level ?? "",
          v.url ?? "",
          translateStatus(v.status ?? "Want to apply"),
          v.fit ?? "med",
          v.applied ?? "",
          v.next ?? "",
          v.notes ?? "",
          JSON.stringify(JSON.parse(v.stack || "[]")),
          v.created ?? new Date().toISOString().slice(0, 10),
        ],
      );
      vacancyIdMap.set(v.id, newId);
    }

    for (const c of companies) {
      await client.query(
        `INSERT INTO companies (user_id, name, notes, questions) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, name) DO NOTHING`,
        [BOOTSTRAP_USER_ID, c.name, c.notes ?? "", JSON.stringify(JSON.parse(c.questions || "[]"))],
      );
    }

    for (const s of srsRows) {
      await client.query(
        `INSERT INTO srs (user_id, card_id, interval_days, due, reps, difficulty, stability, last_review)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (user_id, card_id) DO UPDATE SET
           interval_days=excluded.interval_days, due=excluded.due, reps=excluded.reps,
           difficulty=excluded.difficulty, stability=excluded.stability, last_review=excluded.last_review`,
        [BOOTSTRAP_USER_ID, s.cardId, s.interval ?? 0, s.due, s.reps ?? 0, s.difficulty, s.stability, s.lastReview],
      );
    }

    for (const row of kvToMigrate) {
      await client.query(
        `INSERT INTO user_kv (user_id, k, v) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, k) DO UPDATE SET v=excluded.v, updated_at=now()`,
        [BOOTSTRAP_USER_ID, row.k, row.v],
      );
    }

    for (const h of historyRows) {
      const newVacancyId = vacancyIdMap.get(h.vacancy_id);
      if (newVacancyId == null) continue; // history for a vacancy that (somehow) wasn't migrated
      await client.query(`INSERT INTO vacancy_status_history (user_id, vacancy_id, status, changed_at) VALUES ($1,$2,$3,$4)`, [
        BOOTSTRAP_USER_ID,
        newVacancyId,
        translateStatus(h.status),
        // SQLite's datetime('now') was UTC with no timezone marker — appending 'Z' before parsing
        // avoids the silent local-timezone-shift bug documented on vacancy_status_history.changedAt
        // in db/schema/app.ts.
        new Date(h.changed_at.replace(" ", "T") + "Z").toISOString(),
      ]);
    }

    await client.query("COMMIT");
    log(
      `\n✅ Migrated ${vacancies.length} vacancies, ${srsRows.length} SRS reviews, ${kvToMigrate.length} kv entries, ${historyRows.length} history rows.`,
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`❌ Migration failed and was rolled back — is Postgres running at ${url}?`, e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await migrate();
