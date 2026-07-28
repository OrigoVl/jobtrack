// Market demand — computed from the actual stack of added vacancies. Used in the CV
// review, learning plan, roadmap, analytics, "focus of the week", and the 21-day plan.
import db, { j } from "../db/index.js";

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
 * Map of "skill -> weighted demand" across all added vacancies. The value is rounded to an
 * integer — code and LLM prompts throughout the app (roadmap/analytics/knowledge tips) treat
 * this number as "how many vacancies mention it" (e.g. `needed in ${count} vacancies`), so
 * the rounded number stays readable in the same spirit — old vacancies now just contribute
 * fractions (0.5, 0.25...) instead of exactly 1, so fresh demand outweighs stale demand.
 */
export function demandMap(now: Date = new Date()): Record<string, number> {
  const rows = db.prepare("SELECT stack, created FROM vacancies").all() as { stack: string; created: string }[];
  const weighted: Record<string, number> = {};
  rows.forEach((v) => {
    const weight = recencyWeight(v.created, now);
    j(v.stack).forEach((t) => (weighted[t] = (weighted[t] || 0) + weight));
  });
  const map: Record<string, number> = {};
  for (const [tech, sum] of Object.entries(weighted)) map[tech] = Math.round(sum);
  return map;
}
