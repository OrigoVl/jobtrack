// Market demand — computed from the actual stack of added vacancies. Used in the CV
// review, learning plan, roadmap, analytics, "focus of the week", and the 21-day plan.
import { eq } from "drizzle-orm";
import db from "../db/client.js";
import { vacancies } from "../db/schema/index.js";
import type { UserId } from "../db/user-id.js";

// Previously every vacancy weighed exactly 1, regardless of whether it was added yesterday
// or a year ago — a vacancy from a "dead" market (outdated stack, company no longer hiring)
// permanently occupied the same weight in demand as a fresh one. Exponential time decay
// (recency decay) is the standard approach in time series/recommendation systems for a
// "live" signal: a vacancy's weight halves every HALF_LIFE_DAYS days from its date added.
const HALF_LIFE_DAYS = 90;

/** Vacancy weight by age: 1.0 on the day it's added, 0.5 after HALF_LIFE_DAYS, and so on. */
export function recencyWeight(createdIso: string, now: Date = new Date()): number {
  const created = new Date(createdIso);
  // Missing/malformed date (old seed rows from before the created column existed) — don't
  // penalize for missing data, treat it as just added (weight 1), not 0 (which would zero out the skill's demand).
  if (Number.isNaN(created.getTime())) return 1;
  const ageDays = Math.max(0, (now.getTime() - created.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/**
 * Map of "skill -> weighted demand" from a set of vacancy rows. The value is rounded to an
 * integer — code and LLM prompts throughout the app (roadmap/analytics/knowledge tips) treat
 * this number as "how many vacancies mention it" (e.g. `needed in ${count} vacancies`), so
 * the rounded number stays readable in the same spirit — old vacancies now just contribute
 * fractions (0.5, 0.25...) instead of exactly 1, so fresh demand outweighs stale demand.
 *
 * Pure and DB-free on purpose (no import of db/index.js) — split out from demandMap() below so
 * it can be unit-tested directly with plain arrays, without mocking the database module. This
 * is also the shape the future async repository layer will call once demandMap() itself starts
 * reading from Postgres instead of node:sqlite.
 */
export function computeDemand(rows: { stack: string[]; created: string }[], now: Date = new Date()): Record<string, number> {
  const weighted: Record<string, number> = {};
  rows.forEach((v) => {
    const weight = recencyWeight(v.created, now);
    v.stack.forEach((t) => (weighted[t] = (weighted[t] || 0) + weight));
  });
  const map: Record<string, number> = {};
  for (const [tech, sum] of Object.entries(weighted)) map[tech] = Math.round(sum);
  return map;
}

/** Convenience wrapper: reads every vacancy row and delegates the math to computeDemand(). */
export async function demandMap(userId: UserId, now: Date = new Date()): Promise<Record<string, number>> {
  const rows = await db.select({ stack: vacancies.stack, created: vacancies.created }).from(vacancies).where(eq(vacancies.userId, userId));
  return computeDemand(rows, now);
}
