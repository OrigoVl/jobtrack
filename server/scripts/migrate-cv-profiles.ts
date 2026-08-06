// One-time backfill for the CV Builder's multiple-profiles feature: every account that saved a
// CV under the old single-blob storage (user_kv, keyed "cvDoc"/"cvPresets") gets exactly one
// `cv_profiles` row seeded from it, named "CV 1" (an ordinary, always-renameable display name —
// not a translated wire value). Any existing `cv_shares` row (old single-share-per-user era) gets
// pointed at that same new profile so previously-shared links keep resolving.
//
// Schema migration 0011 (drizzle/0011_lean_tusk.sql) deliberately left cv_shares.profile_id
// NULLABLE so it could be added to a non-empty table without a default — this script is the
// other half of that migration, run once after 0011 is applied. Safe to re-run: it only acts on
// user_kv "cvDoc" rows that don't already have a matching cv_profiles row, and only touches
// cv_shares rows where profile_id is still NULL.
//
// Usage: npx tsx server/scripts/migrate-cv-profiles.ts [--dry-run]
import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import db from "../src/db/client.js";
import { cvProfiles, cvShares, userKv } from "../src/db/schema/index.js";
import type { UserId } from "../src/db/user-id.js";

const dryRun = process.argv.includes("--dry-run");

const cvDocRows = await db.select().from(userKv).where(eq(userKv.k, "cvDoc"));
console.log(`Found ${cvDocRows.length} legacy "cvDoc" row(s) in user_kv.`);

let migrated = 0;
let skippedExisting = 0;

for (const row of cvDocRows) {
  const userId = row.userId as UserId;
  const [existing] = await db.select({ id: cvProfiles.id }).from(cvProfiles).where(eq(cvProfiles.userId, userId));
  if (existing) {
    skippedExisting++;
    continue;
  }
  const [presetsRow] = await db
    .select({ v: userKv.v })
    .from(userKv)
    .where(and(eq(userKv.userId, userId), eq(userKv.k, "cvPresets")));
  if (dryRun) {
    console.log(`[dry-run] would create profile "CV 1" for user ${userId}`);
    migrated++;
    continue;
  }
  await db.insert(cvProfiles).values({ userId, name: "CV 1", doc: row.v, presets: presetsRow?.v ?? [], position: 0 });
  migrated++;
}

const orphanShares = await db.select().from(cvShares).where(isNull(cvShares.profileId));
console.log(`Found ${orphanShares.length} pre-migration cv_shares row(s) missing a profileId.`);

let sharesLinked = 0;
let sharesDropped = 0;

for (const share of orphanShares) {
  const [profile] = await db.select({ id: cvProfiles.id }).from(cvProfiles).where(eq(cvProfiles.userId, share.userId));
  if (!profile) {
    // A share can only exist for a user who'd already saved a doc, so this shouldn't happen —
    // drop it rather than leave a permanently-unresolvable public link.
    if (!dryRun) await db.delete(cvShares).where(eq(cvShares.slug, share.slug));
    sharesDropped++;
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] would link share "${share.slug}" -> profile #${profile.id}`);
  } else {
    await db.update(cvShares).set({ profileId: profile.id }).where(eq(cvShares.slug, share.slug));
  }
  sharesLinked++;
}

if (!dryRun) {
  await db.delete(userKv).where(eq(userKv.k, "cvDoc"));
  await db.delete(userKv).where(eq(userKv.k, "cvPresets"));
}

console.log(
  `\n✅ Done${dryRun ? " (dry-run)" : ""}. Profiles created: ${migrated}, already had one: ${skippedExisting}, ` +
    `shares linked: ${sharesLinked}, shares dropped: ${sharesDropped}.`,
);
process.exit(0);
