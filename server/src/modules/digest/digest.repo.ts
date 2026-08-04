// Repository wrapping the `digest_preferences` table — every user-facing function is scoped by
// `userId`, same as every other repo, EXCEPT listDigestEnabledUsers(), which is deliberately
// global: it's the one thing the background scheduler (digest.scheduler.ts) needs and no route
// ever calls it (mirrors saved-searches.repo.ts's listAllSavedSearches()).
import { and, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { digestPreferences, user } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

export interface DigestPreferences {
  enabled: boolean;
  lastSentAt: string | null;
}

const DEFAULT_PREFERENCES: DigestPreferences = { enabled: false, lastSentAt: null };

export async function getDigestPreferences(userId: UserId): Promise<DigestPreferences> {
  const [row] = await db
    .select({ enabled: digestPreferences.enabled, lastSentAt: digestPreferences.lastSentAt })
    .from(digestPreferences)
    .where(eq(digestPreferences.userId, userId));
  return row ?? DEFAULT_PREFERENCES;
}

export async function setDigestEnabled(userId: UserId, enabled: boolean): Promise<DigestPreferences> {
  await db.insert(digestPreferences).values({ userId, enabled }).onConflictDoUpdate({ target: digestPreferences.userId, set: { enabled } });
  return getDigestPreferences(userId);
}

/** Everything the scheduler needs for one user's digest run: whether/when to send. Global — not
 * scoped by any single userId, since the scheduler iterates every opted-in user in one pass. */
export interface DigestUserForRun {
  userId: UserId;
  userEmail: string;
  lastSentAt: string | null;
}

export async function listDigestEnabledUsers(): Promise<DigestUserForRun[]> {
  const rows = await db
    .select({ userId: digestPreferences.userId, userEmail: user.email, lastSentAt: digestPreferences.lastSentAt })
    .from(digestPreferences)
    .innerJoin(user, eq(user.id, digestPreferences.userId))
    .where(eq(digestPreferences.enabled, true));
  return rows.map((r) => ({ ...r, userId: r.userId as UserId }));
}

export async function recordDigestSent(userId: UserId): Promise<void> {
  await db
    .update(digestPreferences)
    .set({ lastSentAt: new Date().toISOString() })
    .where(and(eq(digestPreferences.userId, userId), eq(digestPreferences.enabled, true)));
}
