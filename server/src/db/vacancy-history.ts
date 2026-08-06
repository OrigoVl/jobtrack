// History of a vacancy's status changes — needed because the vacancies.status column is
// simply overwritten on every update: without a separate log it's impossible to honestly
// count "how many vacancies ever reached stage X" (the real funnel), only "how many are
// currently at stage X" (analytics.routes.ts funnel) — a vacancy rejected at "Tech interview"
// disappears from that stage in the current snapshot, even though it really did pass through it.
//
// Deletion has no explicit "delete history for this vacancy" function: vacancy_status_history
// has a real composite FK to vacancies (user_id, vacancy_id) with ON DELETE CASCADE (see
// db/schema/app.ts), so deleting a vacancy row (vacancies.repo.ts#deleteVacancy) already removes
// its history rows — the old SQLite version had to do this by hand because it never had FKs enabled.
import { and, asc, countDistinct, eq, gte } from "drizzle-orm";
import db from "./client.js";
import { vacancyStatusHistory } from "./schema/index.js";
import type { UserId } from "./user-id.js";
import { recordApplyActivity } from "./kv.js";

export async function recordStatusChange(userId: UserId, vacancyId: number, status: string): Promise<void> {
  await db.insert(vacancyStatusHistory).values({ userId, vacancyId, status });
  // Every route that moves a vacancy to "Applied" funnels through here, so this is the one
  // place an apply-streak tick needs to live — no route handler needs to know the streak exists.
  if (status === "Applied") await recordApplyActivity(userId);
}

/** Count of DISTINCT vacancies that reached "Applied" on or after `since` — the weekly-goal
 * progress number. Distinct, not raw row count: re-applying to the same vacancy within the
 * window (a rare "reopened, applied again" edge case) shouldn't inflate a goal about how many
 * different jobs were applied to. */
export async function getAppliedCountSince(userId: UserId, since: Date): Promise<number> {
  const [row] = await db
    .select({ c: countDistinct(vacancyStatusHistory.vacancyId) })
    .from(vacancyStatusHistory)
    .where(
      and(eq(vacancyStatusHistory.userId, userId), eq(vacancyStatusHistory.status, "Applied"), gte(vacancyStatusHistory.changedAt, since)),
    );
  return Number(row?.c ?? 0);
}

/** Count of UNIQUE vacancies that ever had each status (regardless of their current one). */
export async function getReachedCounts(userId: UserId): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: vacancyStatusHistory.status, c: countDistinct(vacancyStatusHistory.vacancyId) })
    .from(vacancyStatusHistory)
    .where(eq(vacancyStatusHistory.userId, userId))
    .groupBy(vacancyStatusHistory.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)]));
}

export interface StageConversion {
  from: string;
  to: string;
  /** % of vacancies that reached `from` which LATER (or at the same time) also reached `to`. null — no vacancy has reached `from` yet. */
  rate: number | null;
}

/**
 * Conversion between ADJACENT stages of a given order (e.g. funnelOrder from
 * analytics.routes.ts) — a classic funnel metric: what share of those who reached stage N
 * also reached N+1. Does NOT assume strictly linear movement (a vacancy can "skip" a stage or
 * go to "Rejected" from any stage) — that's correct, since it only counts "was it EVER on both
 * stages", not the sequence of transitions.
 *
 * Pure and DB-free on purpose — takes already-computed reached counts rather than querying
 * itself, so it's unit-testable with plain objects. See getFunnelConversion() below for the
 * thin DB-backed wrapper every current call site actually uses.
 */
export function computeFunnelConversion(reached: Record<string, number>, order: readonly string[]): StageConversion[] {
  const result: StageConversion[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i]!;
    const to = order[i + 1]!;
    const fromCount = reached[from] || 0;
    const toCount = reached[to] || 0;
    result.push({ from, to, rate: fromCount > 0 ? Math.round((Math.min(toCount, fromCount) / fromCount) * 100) : null });
  }
  return result;
}

/** Convenience wrapper: reads reached-counts from the DB and delegates to computeFunnelConversion(). */
export async function getFunnelConversion(userId: UserId, order: readonly string[]): Promise<StageConversion[]> {
  return computeFunnelConversion(await getReachedCounts(userId), order);
}

export interface StageDuration {
  status: string;
  /** Average number of days BETWEEN entering this status and the NEXT status change (across all vacancies). */
  avgDays: number;
  /** Number of transitions averaged into avgDays — so the UI can hide statistically insignificant rows (e.g. count===1). */
  count: number;
}

/**
 * Average "dwell time" in each status — for each vacancy we look at CONSECUTIVE pairs of
 * history records (ordered by time) and compute the difference in days. The same principle
 * as "time in state" survival analysis: shows which stage the candidate/recruiter tends to
 * linger in the longest — information the static funnel/funnelReached numbers don't have
 * (only "how many", not "how long").
 *
 * Pure and DB-free on purpose — takes rows already ordered by (vacancy_id, changed_at) rather
 * than querying itself, so it's unit-testable with plain arrays.
 */
export function avgDaysFromHistoryRows(rows: { vacancy_id: number; status: string; changed_at: Date }[]): StageDuration[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (let i = 0; i < rows.length - 1; i++) {
    const cur = rows[i]!;
    const next = rows[i + 1]!;
    if (next.vacancy_id !== cur.vacancy_id) continue; // boundary between different vacancies — not a transition pair
    const days = (next.changed_at.getTime() - cur.changed_at.getTime()) / 86_400_000;
    if (!Number.isFinite(days) || days < 0) continue;
    const acc = sums.get(cur.status) ?? { total: 0, count: 0 };
    acc.total += days;
    acc.count += 1;
    sums.set(cur.status, acc);
  }
  return [...sums.entries()]
    .map(([status, { total, count }]) => ({ status, avgDays: Math.round((total / count) * 10) / 10, count }))
    .sort((a, b) => b.avgDays - a.avgDays);
}

/** Convenience wrapper: reads ordered history rows from the DB and delegates to avgDaysFromHistoryRows(). */
export async function getAvgDaysInStage(userId: UserId): Promise<StageDuration[]> {
  const rows = await db
    .select({ vacancyId: vacancyStatusHistory.vacancyId, status: vacancyStatusHistory.status, changedAt: vacancyStatusHistory.changedAt })
    .from(vacancyStatusHistory)
    .where(eq(vacancyStatusHistory.userId, userId))
    .orderBy(asc(vacancyStatusHistory.vacancyId), asc(vacancyStatusHistory.changedAt));
  return avgDaysFromHistoryRows(rows.map((r) => ({ vacancy_id: r.vacancyId, status: r.status, changed_at: r.changedAt })));
}
