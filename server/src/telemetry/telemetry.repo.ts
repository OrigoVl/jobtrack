// Persistence for admin telemetry (Phase 6): both functions are meant to be called WITHOUT
// awaiting from their call sites (llm/client.ts, embeddings.ts, jobs.routes.ts) — a slow or
// failing insert here must never add latency or an error to the user's actual request, so each
// function swallows its own errors (logged, never thrown/rejected to the caller).
//
// `db/client.js` is imported LAZILY (dynamic import inside each function, not a static top-level
// import) for the same reason core/http.ts's getSession() does it: llm/client.ts and
// embeddings.ts call into this module, and a static import here would give a real Postgres
// connection (with its own migrate-on-boot side effect) to every test that imports THOSE
// modules — including llm/client.test.ts, which deliberately mocks only db/llm-cache.js and
// has nothing to do with telemetry persistence.
import { and, eq, gte, sum } from "drizzle-orm";
import { llmUsage, productEvents } from "../db/schema/index.js";
import type { UserId } from "../db/user-id.js";
import { contextLogger } from "../core/logger.js";
import { getRequestId } from "../core/request-context.js";
import { estimateCostUsd } from "../llm/pricing.js";

export type LlmUsageOutcome = "success" | "error" | "cache_hit" | "budget_exceeded";

export interface LlmUsageRecord {
  userId: UserId;
  feature: string;
  // `string | null`, not LlmTier/LlmProvider from llm/client.ts — importing those types here
  // would create client.ts <-> telemetry.repo.ts import cycle for zero benefit (this table
  // stores them as plain text anyway).
  provider: string | null;
  model: string | null;
  tier: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheHit: boolean;
  latencyMs: number | null;
  outcome: LlmUsageOutcome;
}

export async function insertLlmUsage(record: LlmUsageRecord): Promise<void> {
  // Read the request's reqId synchronously, before the first `await` below — AsyncLocalStorage's
  // context is tied to the call's synchronous entry, not to whether the caller awaits this
  // promise (see llm/client.ts's recordLlmUsage, which calls this without awaiting).
  const reqId = getRequestId() ?? null;
  try {
    const { default: db } = await import("../db/client.js");
    await db.insert(llmUsage).values({
      userId: record.userId,
      feature: record.feature,
      provider: record.provider,
      model: record.model,
      tier: record.tier,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      costUsd: estimateCostUsd(record.model, record.inputTokens, record.outputTokens),
      cacheHit: record.cacheHit,
      latencyMs: record.latencyMs,
      outcome: record.outcome,
      reqId,
    });
  } catch (err) {
    contextLogger().error({ err, feature: record.feature }, "Failed to persist LLM usage telemetry");
  }
}

/**
 * Sum of estimated cost (llm/pricing.ts) for this user's LLM calls since `since` — backs
 * llm/client.ts's optional per-user daily cost cap (env.llm.dailyCostCapUsd). Returns null (NOT
 * 0) on a DB failure, same fail-open reasoning as insertLlmUsage's swallowed errors above — a
 * telemetry read failure must never be the reason a user's AI features stop working.
 */
export async function getUserCostUsdSince(userId: UserId, since: Date): Promise<number | null> {
  try {
    const { default: db } = await import("../db/client.js");
    const [row] = await db
      .select({ cost: sum(llmUsage.costUsd) })
      .from(llmUsage)
      .where(and(eq(llmUsage.userId, userId), gte(llmUsage.createdAt, since)));
    return Number(row?.cost ?? 0);
  } catch (err) {
    contextLogger().error({ err, userId }, "Failed to read user's LLM cost telemetry");
    return null;
  }
}

export async function insertProductEvent(userId: UserId, name: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    const { default: db } = await import("../db/client.js");
    await db.insert(productEvents).values({ userId, name, metadata });
  } catch (err) {
    contextLogger().error({ err, name }, "Failed to persist product event telemetry");
  }
}
