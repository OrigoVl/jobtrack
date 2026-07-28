// Explicit per-user bootstrap step: seeds a default profile + sample vacancies (with matching
// status history) for a user that has none yet, so the app has something to work with right
// away. Previously this ran as an import-time side effect in client.ts against the single
// SQLite file — incompatible with a real multi-user Postgres, where "seed if empty" has to be
// a per-user check, not a whole-table one. Called once at server startup for BOOTSTRAP_USER_ID
// (server/src/index.ts); phase 3 (better-auth) calls this same function on real user
// registration instead, with that user's real id — no other change needed here.
import { and, eq } from "drizzle-orm";
import db from "./client.js";
import { userKv, vacancies } from "./schema/index.js";
import { setProfile } from "./kv.js";
import { recordStatusChange } from "./vacancy-history.js";
import { DEFAULT_PROFILE, SEED_VACANCIES } from "./seed-vacancies.js";
import type { UserId } from "./user-id.js";

async function seedProfileIfEmpty(userId: UserId): Promise<void> {
  const [row] = await db
    .select({ k: userKv.k })
    .from(userKv)
    .where(and(eq(userKv.userId, userId), eq(userKv.k, "profile")));
  if (row) return;
  await setProfile(userId, DEFAULT_PROFILE);
}

async function seedVacanciesIfEmpty(userId: UserId): Promise<void> {
  const [row] = await db.select({ id: vacancies.id }).from(vacancies).where(eq(vacancies.userId, userId)).limit(1);
  if (row) return;
  for (const [company, position, level, url, fit, stack] of SEED_VACANCIES) {
    const [inserted] = await db
      .insert(vacancies)
      .values({ userId, company, position, level, url, status: "Applied", fit, stack })
      .returning({ id: vacancies.id });
    await recordStatusChange(userId, inserted!.id, "Applied");
  }
}

export async function bootstrapUser(userId: UserId): Promise<void> {
  await seedProfileIfEmpty(userId);
  await seedVacanciesIfEmpty(userId);
}
