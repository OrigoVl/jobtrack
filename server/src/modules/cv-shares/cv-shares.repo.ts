// Repository wrapping the `cv_shares` table — one row per (user, profile), unique on
// (userId, profileId). "Generate" upserts a fresh random slug for that profile (the previous one,
// if any, stops resolving — see cv-shares.routes.ts), "enable"/"disable" just flips the flag
// without touching the slug.
import { and, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { cvShares } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import { randomSlug } from "../../shared/slug.js";

export interface CvShare {
  slug: string;
  enabled: boolean;
}

/** Full row (incl. userId/profileId) — only for the PUBLIC lookup-by-slug path (cv-shares.routes.ts'
 * GET /cv/public/:slug), which needs to know WHOSE profile doc to fetch next. */
export interface CvShareRow extends CvShare {
  userId: UserId;
  profileId: number;
}

export async function getShareByProfile(userId: UserId, profileId: number): Promise<CvShare | undefined> {
  const [row] = await db
    .select({ slug: cvShares.slug, enabled: cvShares.enabled })
    .from(cvShares)
    .where(and(eq(cvShares.userId, userId), eq(cvShares.profileId, profileId)));
  return row;
}

export async function getShareBySlug(slug: string): Promise<CvShareRow | undefined> {
  const [row] = await db.select().from(cvShares).where(eq(cvShares.slug, slug));
  if (!row || row.profileId === null) return undefined;
  return { slug: row.slug, userId: row.userId as UserId, profileId: row.profileId, enabled: row.enabled };
}

/** Creates a fresh share link for this profile, or replaces its existing one with a NEW slug
 * (re-enabled) — `ON CONFLICT (user_id, profile_id)` via the table's unique index, not a separate
 * select-then-insert-or-update. The old slug (if any) simply stops resolving to anything. */
export async function generateShare(userId: UserId, profileId: number): Promise<CvShare> {
  const slug = randomSlug();
  await db
    .insert(cvShares)
    .values({ userId, profileId, slug, enabled: true })
    .onConflictDoUpdate({ target: [cvShares.userId, cvShares.profileId], set: { slug, enabled: true, createdAt: new Date() } });
  return { slug, enabled: true };
}

export async function setShareEnabled(userId: UserId, profileId: number, enabled: boolean): Promise<CvShare | undefined> {
  const [row] = await db
    .update(cvShares)
    .set({ enabled })
    .where(and(eq(cvShares.userId, userId), eq(cvShares.profileId, profileId)))
    .returning({ slug: cvShares.slug, enabled: cvShares.enabled });
  return row;
}
