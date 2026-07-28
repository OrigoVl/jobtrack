// History of a vacancy's status changes — needed because the vacancies.status column is
// simply overwritten on every update: without a separate log it's impossible to honestly
// count "how many vacancies ever reached stage X" (the real funnel), only "how many are
// currently at stage X" (analytics.routes.ts funnel) — a vacancy rejected at "Tech interview"
// disappears from that stage in the current snapshot, even though it really did pass through it.
import db from "./client.js";

export function recordStatusChange(vacancyId: number, status: string): void {
  db.prepare("INSERT INTO vacancy_status_history (vacancy_id, status) VALUES (?, ?)").run(vacancyId, status);
}

/** Count of UNIQUE vacancies that ever had each status (regardless of their current one). */
export function getReachedCounts(): Record<string, number> {
  const rows = db.prepare("SELECT status, COUNT(DISTINCT vacancy_id) c FROM vacancy_status_history GROUP BY status").all() as {
    status: string;
    c: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)]));
}

export function deleteHistoryForVacancy(vacancyId: number): void {
  db.prepare("DELETE FROM vacancy_status_history WHERE vacancy_id = ?").run(vacancyId);
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
export function getFunnelConversion(order: readonly string[]): StageConversion[] {
  return computeFunnelConversion(getReachedCounts(), order);
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
 * than querying itself, so it's unit-testable with plain arrays. `changed_at` takes a `Date`
 * (not a string) because the Postgres schema stores this column as `timestamptz`, unlike the
 * old SQLite `datetime('now')` text.
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
export function getAvgDaysInStage(): StageDuration[] {
  const rows = db.prepare("SELECT vacancy_id, status, changed_at FROM vacancy_status_history ORDER BY vacancy_id, changed_at").all() as {
    vacancy_id: number;
    status: string;
    changed_at: string;
  }[];
  return avgDaysFromHistoryRows(rows.map((r) => ({ ...r, changed_at: new Date(r.changed_at) })));
}
