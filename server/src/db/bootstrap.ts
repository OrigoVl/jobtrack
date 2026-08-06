// Explicit per-user seeding steps — previously ran as an import-time side effect in client.ts
// against the single SQLite file, incompatible with a real multi-user Postgres, where "seed if
// empty" has to be a per-user check, not a whole-table one.
//
// `seedProfileIfEmpty` alone is hooked into real user registration (auth/auth.ts's
// `databaseHooks.user.create.after`) — every new account needs at least a profile row, or
// getProfile() throws and most features break on first use. `bootstrapUser` (profile + the full
// sample vacancy set) is NOT wired into registration — seeding a brand-new real user with fake
// demo vacancies is a separate, still-open product decision (see the phase-4 plan notes). It's
// kept here, tested, for that future decision; nothing in the running app calls it today. (It
// used to run once at server startup for the phase-2 BOOTSTRAP_USER_ID constant — removed once
// real auth landed, since that id was never a real row in better-auth's `user` table and every
// app table's user_id is now a real FK to it.)
import { and, eq } from "drizzle-orm";
import db from "./client.js";
import { userKv, vacancies } from "./schema/index.js";
import { setProfile } from "./kv.js";
import { recordStatusChange } from "./vacancy-history.js";
import { EMPTY_PROFILE, SAMPLE_PROFILE, SEED_VACANCIES } from "./seed-vacancies.js";
import type { UserId } from "./user-id.js";

async function hasProfileRow(userId: UserId): Promise<boolean> {
  const [row] = await db
    .select({ k: userKv.k })
    .from(userKv)
    .where(and(eq(userKv.userId, userId), eq(userKv.k, "profile")));
  return !!row;
}

/** Wired into real user registration (auth/auth.ts's `databaseHooks.user.create.after`) — every
 * new account needs at least a profile row, or getProfile() throws and most features break on
 * first use. Writes EMPTY_PROFILE, deliberately NOT SAMPLE_PROFILE below — a stranger who just
 * registered gets a blank slate (and a real 0/4 onboarding checklist), never someone else's
 * fictional résumé. */
export async function seedProfileIfEmpty(userId: UserId): Promise<void> {
  if (await hasProfileRow(userId)) return;
  await setProfile(userId, EMPTY_PROFILE);
}

async function seedSampleProfileIfEmpty(userId: UserId): Promise<void> {
  if (await hasProfileRow(userId)) return;
  await setProfile(userId, SAMPLE_PROFILE);
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

/** The fictional-profile + full sample-vacancy-set path — NOT wired into real registration (see
 * seedProfileIfEmpty above). Kept, tested, for a still-open "seed a demo account with sample
 * data" product decision. */
export async function bootstrapUser(userId: UserId): Promise<void> {
  await seedSampleProfileIfEmpty(userId);
  await seedVacanciesIfEmpty(userId);
}
