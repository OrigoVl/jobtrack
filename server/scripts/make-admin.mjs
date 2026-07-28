// Grants the admin role to an existing (already-registered) user, directly in Postgres — the
// only way to create the first admin (see server/src/auth/auth.ts's comment on why this is
// deliberately NOT an ADMIN_EMAIL-in-.env runtime check: no code path in the running server can
// grant admin on its own, only this explicit, out-of-band script, run by whoever already has
// server/DB access).
//
// Usage: node server/scripts/make-admin.mjs <email>
import "dotenv/config";
import pg from "pg";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node server/scripts/make-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.DATABASE_URL || "postgres://jobtrack:jobtrack@localhost:5432/jobtrack";
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const { rows } = await client.query('UPDATE "user" SET role = $1 WHERE email = $2 RETURNING id, email, role', ["admin", email]);
  if (rows.length === 0) {
    console.error(`❌ No user found with email "${email}" — they need to register first.`);
    process.exit(1);
  }
  console.log(`✅ ${rows[0].email} (id: ${rows[0].id}) is now role="${rows[0].role}".`);
} catch (e) {
  console.error(`❌ Failed — is Postgres running at ${url}?`, e);
  process.exit(1);
} finally {
  await client.end();
}
