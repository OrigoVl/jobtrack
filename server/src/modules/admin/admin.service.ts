// Read-only aggregation queries for the admin panel (Phase 6) — users/activity, LLM usage/cost,
// product analytics. Deliberately proportional to an early-stage app with few users: no
// pre-aggregation tables, no materialized views, just indexed queries (see
// db/schema/telemetry.ts's llm_usage/product_events indexes) scoped to a recent time window.
// Revisit if/when a single admin page load starts scanning meaningfully large tables.
//
// PII note: nothing here ever selects a user's CV text or the raw text of another user's
// individual search query — only counts and aggregates (see getProductEventsSummary's
// topSearchQueries, which groups/counts search terms, never attributes one to a specific user).
import { and, count, desc, eq, gte, ilike, inArray, or, sql, sum } from "drizzle-orm";
import db from "../../db/client.js";
import { llmUsage, productEvents, subscriptions, user, vacancies } from "../../db/schema/index.js";
import { env } from "../../config/env.js";
import { PRO_MONTHLY_PRICE_USD } from "../billing/plans.js";

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
  /** "free" when the user has no subscriptions row at all — same missing-row convention as
   * modules/billing/entitlements.ts, not re-derived through it (this is a display column, not
   * an access-control decision). */
  plan: string;
  subStatus: string;
  llmCostRecentUsd: number;
  /** Calls in `recentDays` blocked by either outcome (budget_exceeded or quota_exceeded) — see
   * telemetry/telemetry.repo.ts#LlmUsageOutcome. Closes the README gap: these outcomes were
   * previously recorded but never surfaced anywhere in the admin panel. */
  blockedCallsRecent: number;
}

export interface AdminUsersResult {
  users: AdminUserRow[];
  total: number;
}

/**
 * Paginated user list with lightweight activity counts. The vacancy/LLM-call counts are scoped
 * to just THIS page's user ids (not a full-table GROUP BY) — the query cost stays proportional
 * to `limit`, not to the total number of users/vacancies/llm_usage rows as those grow. The
 * plan/status columns come from a LEFT JOIN on the main paged query (subscriptions.userId is a
 * 1:1 PK, so this adds no fan-out) rather than a third ids-scoped batch query.
 *
 * `search` (optional) case-insensitively matches name OR email as a substring — beyond the first
 * page/`limit`, an admin otherwise has no way to find a specific account. `total` reflects the
 * SAME filter, so pagination controls stay correct while searching.
 */
export async function listUsersWithActivity(limit = 50, offset = 0, recentDays = 30, search?: string): Promise<AdminUsersResult> {
  const where = search ? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`)) : undefined;
  const [users, [totalRow]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
        plan: subscriptions.plan,
        subStatus: subscriptions.status,
      })
      .from(user)
      .leftJoin(subscriptions, eq(subscriptions.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ c: count() }).from(user).where(where),
  ]);
  const ids = users.map((u) => u.id);
  const [vacancyCounts, llmCounts] = ids.length
    ? await Promise.all([
        db.select({ userId: vacancies.userId, c: count() }).from(vacancies).where(inArray(vacancies.userId, ids)).groupBy(vacancies.userId),
        db
          .select({
            userId: llmUsage.userId,
            c: count(),
            cost: sum(llmUsage.costUsd),
            blocked: sql<number>`count(*) filter (where ${llmUsage.outcome} in ('budget_exceeded', 'quota_exceeded'))`,
          })
          .from(llmUsage)
          .where(and(inArray(llmUsage.userId, ids), gte(llmUsage.createdAt, daysAgo(recentDays))))
          .groupBy(llmUsage.userId),
      ])
    : [[], []];
  const vacancyByUser = new Map(vacancyCounts.map((r) => [r.userId, r.c]));
  const llmByUser = new Map(llmCounts.map((r) => [r.userId, r]));
  return {
    total: totalRow?.c ?? 0,
    users: users.map((u) => {
      const llm = llmByUser.get(u.id);
      return {
        ...u,
        createdAt: u.createdAt.toISOString(),
        vacancyCount: vacancyByUser.get(u.id) ?? 0,
        llmCallsRecent: llm?.c ?? 0,
        plan: u.plan ?? "free",
        subStatus: u.subStatus ?? "inactive",
        llmCostRecentUsd: Number(llm?.cost ?? 0),
        blockedCallsRecent: Number(llm?.blocked ?? 0),
      };
    }),
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
export interface LlmUsageByModel {
  model: string | null;
  calls: number;
  costUsd: number;
}
export interface LlmUsageByTier {
  tier: string | null;
  calls: number;
  costUsd: number;
}
export interface LlmUsageByOutcome {
  outcome: string;
  calls: number;
  costUsd: number;
}
export interface AdminLlmUsageSummary {
  days: number;
  totalCalls: number;
  totalCostUsd: number;
  byFeature: LlmUsageByFeature[];
  byDay: LlmUsageByDay[];
  byModel: LlmUsageByModel[];
  byTier: LlmUsageByTier[];
  /** First time any admin query reads llmUsage.outcome — surfaces budget_exceeded/quota_exceeded
   * counts that were previously recorded but invisible in the panel. */
  byOutcome: LlmUsageByOutcome[];
}

export async function getLlmUsageSummary(days = 30): Promise<AdminLlmUsageSummary> {
  const cutoff = daysAgo(days);
  const dayExpr = sql<string>`to_char(${llmUsage.createdAt}, 'YYYY-MM-DD')`;
  const [byFeature, byDay, byModel, byTier, byOutcome, [totals]] = await Promise.all([
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
      .select({ model: llmUsage.model, calls: count(), costUsd: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff))
      .groupBy(llmUsage.model),
    db
      .select({ tier: llmUsage.tier, calls: count(), costUsd: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff))
      .groupBy(llmUsage.tier),
    db
      .select({ outcome: llmUsage.outcome, calls: count(), costUsd: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff))
      .groupBy(llmUsage.outcome),
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
    byModel: byModel
      .map((r) => ({ model: r.model, calls: r.calls, costUsd: Number(r.costUsd ?? 0) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byTier: byTier.map((r) => ({ tier: r.tier, calls: r.calls, costUsd: Number(r.costUsd ?? 0) })).sort((a, b) => b.costUsd - a.costUsd),
    byOutcome: byOutcome
      .map((r) => ({ outcome: r.outcome, calls: r.calls, costUsd: Number(r.costUsd ?? 0) }))
      .sort((a, b) => b.calls - a.calls),
  };
}

export interface AdminBillingPlanCount {
  plan: string;
  status: string;
  count: number;
}
export interface AdminBillingSummary {
  days: number;
  planCounts: AdminBillingPlanCount[];
  /** count(active/trialing/past_due paid subs) × PRO_MONTHLY_PRICE_USD — a display estimate, not
   * a reconciled Stripe MRR figure (see plans.ts's PRO_MONTHLY_PRICE_USD comment). */
  estimatedMrrUsd: number;
  quotaExceededCount: number;
  budgetExceededCount: number;
}

// Mirrors entitlements.ts's ENTITLED_STATUSES — kept as a separate local constant rather than
// exported/shared, since this one answers "counts toward the MRR estimate", a display concern,
// not "grants access", an authorization concern; the two happen to agree today but have no
// reason to be forced to stay the same function.
const MRR_COUNTED_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function getBillingSummary(days = 30): Promise<AdminBillingSummary> {
  const cutoff = daysAgo(days);
  const [planCounts, [totalUsersRow], [outcomeCounts]] = await Promise.all([
    db
      .select({ plan: subscriptions.plan, status: subscriptions.status, count: count() })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status),
    db.select({ c: count() }).from(user),
    db
      .select({
        quotaExceeded: sql<number>`count(*) filter (where ${llmUsage.outcome} = 'quota_exceeded')`,
        budgetExceeded: sql<number>`count(*) filter (where ${llmUsage.outcome} = 'budget_exceeded')`,
      })
      .from(llmUsage)
      .where(gte(llmUsage.createdAt, cutoff)),
  ]);
  // A user with NO subscriptions row is Free — the same missing-row convention as
  // entitlements.ts. Reconstructed here as (total users) - (users with an explicit non-free
  // row), since a canceled subscription's row is kept (plan reverts to "free") rather than
  // deleted, so it must not be double-counted.
  const paidCount = planCounts.filter((r) => r.plan !== "free").reduce((sumSoFar, r) => sumSoFar + r.count, 0);
  const freeCount = Math.max(0, (totalUsersRow?.c ?? 0) - paidCount);
  const mrrEligibleCount = planCounts
    .filter((r) => r.plan !== "free" && MRR_COUNTED_STATUSES.has(r.status))
    .reduce((sumSoFar, r) => sumSoFar + r.count, 0);
  return {
    days,
    planCounts: [{ plan: "free", status: "inactive", count: freeCount }, ...planCounts.filter((r) => r.plan !== "free")],
    estimatedMrrUsd: mrrEligibleCount * PRO_MONTHLY_PRICE_USD,
    quotaExceededCount: Number(outcomeCounts?.quotaExceeded ?? 0),
    budgetExceededCount: Number(outcomeCounts?.budgetExceeded ?? 0),
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
