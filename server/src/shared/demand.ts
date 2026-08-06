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

export interface VacancyStackRow {
  stack: string[];
  created: string;
}

/** Reads every vacancy row (stack + created) for a user — the shared input to computeDemand()/
 * computeGapPriority() below, so both can be derived from a single query per request. */
export async function vacancyStackRows(userId: UserId): Promise<VacancyStackRow[]> {
  return db.select({ stack: vacancies.stack, created: vacancies.created }).from(vacancies).where(eq(vacancies.userId, userId));
}

/** Convenience wrapper: reads every vacancy row and delegates the math to computeDemand(). */
export async function demandMap(userId: UserId, now: Date = new Date()): Promise<Record<string, number>> {
  return computeDemand(await vacancyStackRows(userId), now);
}

/**
 * "Which gap tech unlocks the most vacancies I'm not currently qualified for?" — a different
 * question than raw demand (computeDemand above), which only counts how often a tech is
 * mentioned, including vacancies the candidate is ALREADY equally far from regardless of this
 * one tech. This is the standard fractional-credit greedy weighted SET COVER heuristic: for each
 * vacancy, its "still missing" techs split ONE unit of credit evenly among themselves (recency-
 * weighted, same decay as computeDemand). A vacancy missing only this one tech hands it a full
 * share; a vacancy missing four techs gives each only a quarter — so a tech scores high here only
 * when it's genuinely the (near-)last piece standing between the candidate and real vacancies,
 * not just because it happens to appear often alongside plenty of OTHER gaps too. Vacancies
 * already fully covered by `skills` contribute nothing (nothing left to unlock there).
 *
 * Pure and DB-free (same reasoning as computeDemand) — the actual set-cover math lives here so
 * every caller (21-day plan, pet projects, learning plan, resources, CV analysis, focus-of-the-
 * week) ranks gaps the same way instead of five slightly-different ad hoc demand-sorts.
 */
export function computeGapPriority(rows: VacancyStackRow[], skills: string[], now: Date = new Date()): Record<string, number> {
  const known = new Set(skills);
  const priority: Record<string, number> = {};
  for (const row of rows) {
    const missing = row.stack.filter((tech) => !known.has(tech));
    if (missing.length === 0) continue;
    const share = recencyWeight(row.created, now) / missing.length;
    for (const tech of missing) priority[tech] = (priority[tech] || 0) + share;
  }
  return priority;
}

/** Convenience wrapper: reads every vacancy row and delegates the math to computeGapPriority(). */
export async function gapPriorityMap(userId: UserId, skills: string[], now: Date = new Date()): Promise<Record<string, number>> {
  return computeGapPriority(await vacancyStackRows(userId), skills, now);
}

/** Technologies the candidate doesn't have yet, ranked by `priority` descending (pass
 * gapPriorityMap()'s output for "which to learn next"; computeDemand()'s for "most mentioned") —
 * pure so each caller can unit-test its own gap-derived logic without re-deriving this ranking.
 * No cap by default: some callers (the learning plan) want every gap, ordered, not just the top N. */
export function topGapTechs(skills: string[], priority: Record<string, number>, limit: number = Infinity): string[] {
  const known = new Set(skills);
  return Object.entries(priority)
    .filter(([tech]) => !known.has(tech))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tech]) => tech);
}
