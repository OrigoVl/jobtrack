// Repository wrapping the `cv_shares` table — one row per user (unique on userId). "Generate"
// upserts a fresh random slug (the previous one, if any, stops resolving — see
// cv-shares.routes.ts), "enable"/"disable" just flips the flag without touching the slug.
import { eq } from "drizzle-orm";
import db from "../../db/client.js";
import { cvShares } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import { randomSlug } from "../../shared/slug.js";

export interface CvShare {
  slug: string;
  enabled: boolean;
}

/** Full row (incl. userId) — only for the PUBLIC lookup-by-slug path (cv-shares.routes.ts'
 * GET /cv/public/:slug), which needs to know WHOSE cvDoc to fetch next. */
export interface CvShareRow extends CvShare {
  userId: UserId;
}

export async function getShareByUserId(userId: UserId): Promise<CvShare | undefined> {
  const [row] = await db.select({ slug: cvShares.slug, enabled: cvShares.enabled }).from(cvShares).where(eq(cvShares.userId, userId));
  return row;
}

export async function getShareBySlug(slug: string): Promise<CvShareRow | undefined> {
  const [row] = await db.select().from(cvShares).where(eq(cvShares.slug, slug));
  return row as CvShareRow | undefined;
}

/** Creates a fresh share link for this user, or replaces their existing one with a NEW slug
 * (re-enabled) — `ON CONFLICT (user_id)` via the table's unique index, not a separate
 * select-then-insert-or-update. The old slug (if any) simply stops resolving to anything. */
export async function generateShare(userId: UserId): Promise<CvShare> {
  const slug = randomSlug();
  await db
    .insert(cvShares)
    .values({ userId, slug, enabled: true })
    .onConflictDoUpdate({ target: cvShares.userId, set: { slug, enabled: true, createdAt: new Date() } });
  return { slug, enabled: true };
}

export async function setShareEnabled(userId: UserId, enabled: boolean): Promise<CvShare | undefined> {
  const [row] = await db
    .update(cvShares)
    .set({ enabled })
    .where(eq(cvShares.userId, userId))
    .returning({ slug: cvShares.slug, enabled: cvShares.enabled });
  return row;
}
