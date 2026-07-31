// Repository wrapping the `saved_searches` table (job alerts). Every user-facing function is
// scoped by `userId`, same as every other repo — EXCEPT listAllSavedSearches(), which is
// deliberately global: it's the one thing the background scheduler (saved-searches.scheduler.ts)
// needs and no route ever calls it.
import { and, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { savedSearches, user } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { SavedSearchInput } from "../../shared/validation.js";

export interface SavedSearch {
  id: number;
  query: string;
  region: string;
  label: string | null;
  lastNotifiedAt: string | null;
}

export async function listSavedSearches(userId: UserId): Promise<SavedSearch[]> {
  return db
    .select({
      id: savedSearches.id,
      query: savedSearches.query,
      region: savedSearches.region,
      label: savedSearches.label,
      lastNotifiedAt: savedSearches.lastNotifiedAt,
    })
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(savedSearches.id);
}

export async function createSavedSearch(userId: UserId, input: SavedSearchInput): Promise<SavedSearch> {
  const [row] = await db
    .insert(savedSearches)
    .values({ userId, ...input })
    .returning({
      id: savedSearches.id,
      query: savedSearches.query,
      region: savedSearches.region,
      label: savedSearches.label,
      lastNotifiedAt: savedSearches.lastNotifiedAt,
    });
  return row!;
}

export async function deleteSavedSearch(userId: UserId, id: number): Promise<number> {
  const deleted = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.userId, userId), eq(savedSearches.id, id)))
    .returning({ id: savedSearches.id });
  return deleted.length;
}

/** Everything the scheduler needs for one saved search's run: which query/region to re-fetch,
 * what it saw last time (to diff against), and where to email new postings. Global — not
 * scoped by any single userId, since the scheduler iterates every user's alerts in one pass. */
export interface SavedSearchForRun {
  id: number;
  userId: UserId;
  query: string;
  region: string;
  label: string | null;
  lastSeenUrls: string[];
  lastNotifiedAt: string | null;
  userEmail: string;
}

export async function listAllSavedSearches(): Promise<SavedSearchForRun[]> {
  const rows = await db
    .select({
      id: savedSearches.id,
      userId: savedSearches.userId,
      query: savedSearches.query,
      region: savedSearches.region,
      label: savedSearches.label,
      lastSeenUrls: savedSearches.lastSeenUrls,
      lastNotifiedAt: savedSearches.lastNotifiedAt,
      userEmail: user.email,
    })
    .from(savedSearches)
    .innerJoin(user, eq(user.id, savedSearches.userId));
  return rows.map((r) => ({ ...r, userId: r.userId as UserId }));
}

/** Always advances `lastSeenUrls` (so future diffs stay correct even on a run with nothing
 * new); `lastNotifiedAt` only moves when `notified` is true — it means "the last time we
 * actually emailed this user", not "the last time the scheduler looked at this search". */
export async function recordRunResult(id: number, lastSeenUrls: string[], notified: boolean): Promise<void> {
  await db
    .update(savedSearches)
    .set(notified ? { lastSeenUrls, lastNotifiedAt: new Date().toISOString() } : { lastSeenUrls })
    .where(eq(savedSearches.id, id));
}
