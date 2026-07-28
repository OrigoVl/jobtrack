// One-time reassignment: moves all rows scoped to the phase-2 bootstrap constant
// ("bootstrap-user", see server/src/db/user-id.ts) onto a real, already-registered account —
// for whoever's personal data was seeded/migrated back when there was no real auth yet.
//
// Registering creates a fresh default profile row for the new account (see auth/auth.ts's
// `databaseHooks.user.create.after`) — since the incoming bootstrap data is the REAL data being
// restored, this script deletes the target user's freshly-seeded rows first (only for
// keys/cards that also exist in the bootstrap data) so the reassignment doesn't hit a
// composite-PK conflict on `user_kv`/`srs`, then reassigns every table.
//
// Usage: node server/scripts/claim-bootstrap-data.mjs <email>
import "dotenv/config";
import pg from "pg";

const BOOTSTRAP_USER_ID = "bootstrap-user";
const email = process.argv[2];
if (!email) {
  console.error("Usage: node server/scripts/claim-bootstrap-data.mjs <email>");
  process.exit(1);
}

const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack";
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();

  const {
    rows: [target],
  } = await client.query('SELECT id, email FROM "user" WHERE email = $1', [email]);
  if (!target) {
    console.error(`❌ No user found with email "${email}" — they need to register first.`);
    process.exit(1);
  }
  if (target.id === BOOTSTRAP_USER_ID) {
    console.error("❌ That is the bootstrap id itself, not a real user — nothing to claim.");
    process.exit(1);
  }

  await client.query("BEGIN");

  // Clear the target's freshly-seeded rows that would otherwise collide with the incoming
  // bootstrap data on a composite (user_id, key) primary key.
  await client.query(`DELETE FROM user_kv WHERE user_id = $1 AND k IN (SELECT k FROM user_kv WHERE user_id = $2)`, [
    target.id,
    BOOTSTRAP_USER_ID,
  ]);
  await client.query(`DELETE FROM srs WHERE user_id = $1 AND card_id IN (SELECT card_id FROM srs WHERE user_id = $2)`, [
    target.id,
    BOOTSTRAP_USER_ID,
  ]);

  const tables = ["vacancies", "companies", "srs", "user_kv", "vacancy_status_history"];
  const counts = {};
  for (const table of tables) {
    const { rowCount } = await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2`, [target.id, BOOTSTRAP_USER_ID]);
    counts[table] = rowCount;
  }

  // The placeholder `user` row migrate-sqlite-data.mjs created to satisfy the FK is now empty
  // (every table above was just reassigned away from it) — remove it. A no-op if it never
  // existed (e.g. claiming with no prior SQLite migration).
  await client.query('DELETE FROM "user" WHERE id = $1', [BOOTSTRAP_USER_ID]);

  await client.query("COMMIT");
  console.log(`✅ Claimed bootstrap data for ${target.email} (id: ${target.id}):`);
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table}: ${count} rows`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`❌ Claim failed and was rolled back — is Postgres running at ${url}?`, e);
  process.exit(1);
} finally {
  await client.end();
}
