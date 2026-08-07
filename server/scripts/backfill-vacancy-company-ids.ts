// One-time backfill for the structural `vacancies.company_id` FK (migration 0014,
// server/drizzle/0014_natural_pete_wisdom.sql): before this column existed, `vacancies.company`
// was a freeform text field with no link to the `companies` table. For every vacancy that still
// has companyId NULL and a non-empty `company` text, this looks for a `companies` row owned by
// the same user whose `name` matches case-insensitively (trimmed, exact match — no fuzzy
// matching). Exactly one match -> link it. Zero or multiple matches -> skip and log; a user can
// always link a vacancy to a company manually afterward via the UI, so this is best-effort only.
//
// Safe to re-run: it only ever selects/touches rows where company_id IS NULL, so vacancies
// already linked (by this script or manually) are left untouched on a second pass.
//
// Usage: npx tsx server/scripts/backfill-vacancy-company-ids.ts [--dry-run]
import "dotenv/config";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import db from "../src/db/client.js";
import { companies, vacancies } from "../src/db/schema/index.js";
import type { UserId } from "../src/db/user-id.js";

const dryRun = process.argv.includes("--dry-run");

const rows = await db
  .select({
    id: vacancies.id,
    userId: vacancies.userId,
    company: vacancies.company,
  })
  .from(vacancies)
  .where(and(isNull(vacancies.companyId), ne(vacancies.company, "")));

console.log(`Found ${rows.length} vacancy(ies) with companyId NULL and a non-empty company name.`);

let updated = 0;
let skippedNoMatch = 0;
let skippedAmbiguous = 0;

for (const row of rows) {
  const userId = row.userId as UserId;
  const name = row.company.trim();
  if (!name) {
    skippedNoMatch++;
    continue;
  }

  const matches = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.userId, userId), sql`lower(${companies.name}) = lower(${name})`));

  if (matches.length === 0) {
    skippedNoMatch++;
    console.log(`  no match for vacancy #${row.id} (user ${userId}, company "${row.company}")`);
    continue;
  }
  if (matches.length > 1) {
    skippedAmbiguous++;
    console.log(`  ambiguous match for vacancy #${row.id} (user ${userId}, company "${row.company}") — ${matches.length} companies match`);
    continue;
  }

  const match = matches[0]!;
  if (dryRun) {
    console.log(`[dry-run] would link vacancy #${row.id} -> company #${match.id} ("${row.company}")`);
  } else {
    await db.update(vacancies).set({ companyId: match.id }).where(eq(vacancies.id, row.id));
  }
  updated++;
}

console.log(
  `\n✅ Done${dryRun ? " (dry-run)" : ""}. Scanned: ${rows.length}, linked: ${updated}, ` +
    `skipped (no match): ${skippedNoMatch}, skipped (ambiguous): ${skippedAmbiguous}.`,
);
process.exit(0);
