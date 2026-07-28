// Read-only aggregation queries for the admin panel (Phase 6) — users/activity, LLM usage/cost,
// product analytics. Deliberately proportional to an early-stage app with few users: no
// pre-aggregation tables, no materialized views, just indexed queries (see
// db/schema/telemetry.ts's llm_usage/product_events indexes) scoped to a recent time window.
// Revisit if/when a single admin page load starts scanning meaningfully large tables.
//
// PII note: nothing here ever selects a user's CV text or the raw text of another user's
// individual search query — only counts and aggregates (see getProductEventsSummary's
// topSearchQueries, which groups/counts search terms, never attributes one to a specific user).
import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";
import db from "../../db/client.js";
import { llmUsage, productEvents, user, vacancies } from "../../db/schema/index.js";
import { env } from "../../config/env.js";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export interface AdminOverview {
  totalUsers: number;
  totalVacancies: number;
  days: number;
  llmCostUsd: number;
  llmCalls: number;
  logsDashboardUrl: string | null;
}

export async function getOverview(days = 30): Promise<AdminOverview> {
  const cutoff = daysAgo(days);
  const [[usersRow], [vacanciesRow], [llmRow]] = await Promise.all([
    db.select({ c: count() }).from(user),
    db.select({ c: count() }).from(vacancies),
    db
      .select({ c: count(), cost: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff)),
  ]);
  return {
    totalUsers: usersRow?.c ?? 0,
    totalVacancies: vacanciesRow?.c ?? 0,
    days,
    llmCostUsd: Number(llmRow?.cost ?? 0),
    llmCalls: llmRow?.c ?? 0,
    logsDashboardUrl: env.logsDashboardUrl,
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  createdAt: string;
  vacancyCount: number;
  llmCallsRecent: number;
}

export interface AdminUsersResult {
  users: AdminUserRow[];
  total: number;
}

/**
 * Paginated user list with lightweight activity counts. The vacancy/LLM-call counts are scoped
 * to just THIS page's user ids (not a full-table GROUP BY) — the query cost stays proportional
 * to `limit`, not to the total number of users/vacancies/llm_usage rows as those grow.
 */
export async function listUsersWithActivity(limit = 50, offset = 0, recentDays = 30): Promise<AdminUsersResult> {
  const [users, [totalRow]] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, createdAt: user.createdAt })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ c: count() }).from(user),
  ]);
  const ids = users.map((u) => u.id);
  const [vacancyCounts, llmCounts] = ids.length
    ? await Promise.all([
        db.select({ userId: vacancies.userId, c: count() }).from(vacancies).where(inArray(vacancies.userId, ids)).groupBy(vacancies.userId),
        db
          .select({ userId: llmUsage.userId, c: count() })
          .from(llmUsage)
          .where(and(inArray(llmUsage.userId, ids), gte(llmUsage.createdAt, daysAgo(recentDays))))
          .groupBy(llmUsage.userId),
      ])
    : [[], []];
  const vacancyByUser = new Map(vacancyCounts.map((r) => [r.userId, r.c]));
  const llmByUser = new Map(llmCounts.map((r) => [r.userId, r.c]));
  return {
    total: totalRow?.c ?? 0,
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      vacancyCount: vacancyByUser.get(u.id) ?? 0,
      llmCallsRecent: llmByUser.get(u.id) ?? 0,
    })),
  };
}

export interface LlmUsageByFeature {
  feature: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}
export interface LlmUsageByDay {
  day: string;
  calls: number;
  costUsd: number;
}
export interface AdminLlmUsageSummary {
  days: number;
  totalCalls: number;
  totalCostUsd: number;
  byFeature: LlmUsageByFeature[];
  byDay: LlmUsageByDay[];
}

export async function getLlmUsageSummary(days = 30): Promise<AdminLlmUsageSummary> {
  const cutoff = daysAgo(days);
  const dayExpr = sql<string>`to_char(${llmUsage.createdAt}, 'YYYY-MM-DD')`;
  const [byFeature, byDay, [totals]] = await Promise.all([
    db
      .select({ feature: llmUsage.feature, calls: count(), totalTokens: sum(llmUsage.totalTokens), costUsd: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff))
      .groupBy(llmUsage.feature),
    db
      .select({ day: dayExpr.as("day"), calls: count(), costUsd: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff))
      .groupBy(dayExpr)
      .orderBy(dayExpr),
    db
      .select({ c: count(), cost: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff)),
  ]);
  return {
    days,
    totalCalls: totals?.c ?? 0,
    totalCostUsd: Number(totals?.cost ?? 0),
    byFeature: byFeature
      .map((r) => ({ feature: r.feature, calls: r.calls, totalTokens: Number(r.totalTokens ?? 0), costUsd: Number(r.costUsd ?? 0) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byDay: byDay.map((r) => ({ day: r.day, calls: r.calls, costUsd: Number(r.costUsd ?? 0) })),
  };
}

export interface ProductEventCount {
  name: string;
  count: number;
}
export interface ProductEventsByDay {
  day: string;
  count: number;
}
export interface TopSearchQuery {
  query: string;
  count: number;
}
export interface AdminProductEventsSummary {
  days: number;
  byName: ProductEventCount[];
  searchesByDay: ProductEventsByDay[];
  topSearchQueries: TopSearchQuery[];
}

export async function getProductEventsSummary(days = 30): Promise<AdminProductEventsSummary> {
  const cutoff = daysAgo(days);
  const dayExpr = sql<string>`to_char(${productEvents.createdAt}, 'YYYY-MM-DD')`;
  // Grouped/counted, never joined back to a specific user — this is the aggregate view the
  // admin sees for search terms, not a per-user search history.
  const queryExpr = sql<string>`lower(trim(${productEvents.metadata}->>'query'))`;
  const [byName, searchesByDay, topSearchQueries] = await Promise.all([
    db
      .select({ name: productEvents.name, count: count() })
      .from(productEvents)
      .where(gte(productEvents.createdAt, cutoff))
      .groupBy(productEvents.name),
    db
      .select({ day: dayExpr.as("day"), count: count() })
      .from(productEvents)
      .where(and(eq(productEvents.name, "job_search"), gte(productEvents.createdAt, cutoff)))
      .groupBy(dayExpr)
      .orderBy(dayExpr),
    db
      .select({ query: queryExpr.as("query"), count: count() })
      .from(productEvents)
      .where(
        and(
          eq(productEvents.name, "job_search"),
          gte(productEvents.createdAt, cutoff),
          sql`(${productEvents.metadata} ->> 'query') is not null and (${productEvents.metadata} ->> 'query') <> ''`,
        ),
      )
      .groupBy(queryExpr)
      .orderBy(desc(count()))
      .limit(10),
  ]);
  return { days, byName, searchesByDay, topSearchQueries };
}
