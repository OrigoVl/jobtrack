// Telemetry persisted for the admin panel (Phase 6): what each LLM call cost, and what users
// actually do in the product. Nothing here feeds back into request handling — both tables are
// written fire-and-forget from telemetry/telemetry.repo.ts, so a slow/failed insert never adds
// latency or an error to the user's actual request.
import { pgTable, integer, text, jsonb, real, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

const userIdCol = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// One row per chat()/embed() call. `provider`/`model` are nullable — a cache hit never reaches a
// provider, so there's nothing truthful to put there (the value that originally produced the
// cached response may not even be the same provider, since the cache key is tier-scoped, not
// provider-scoped — see llm/client.ts). `costUsd` is nullable for the same reason `estimateCostUsd`
// (llm/pricing.ts) returns null: an unrecognized model must not silently show as $0.
export const llmUsage = pgTable(
  "llm_usage",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    // Which product feature triggered this call (e.g. "cv-review", "mock-interview") — chat()
    // callers pass this via ChatOptions.feature; see llm/client.ts. Free text, not an enum: new
    // features get a new value here with zero schema changes.
    feature: text().notNull(),
    provider: text(),
    model: text(),
    tier: text(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsd: real("cost_usd"),
    cacheHit: boolean("cache_hit").notNull().default(false),
    latencyMs: integer("latency_ms"),
    outcome: text().notNull(), // "success" | "error" | "cache_hit"
    reqId: text("req_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Covers "this user's usage/cost over time" (admin per-user drilldown) and "recent usage" scans.
    index("llm_usage_user_created_idx").on(t.userId, t.createdAt),
    // Covers "cost by feature" aggregation (the admin's main LLM-cost view).
    index("llm_usage_feature_idx").on(t.feature),
  ],
);

// Generic product analytics event — one row per tracked action (today: job search; more event
// names can be added later without a schema change, since `metadata` is free-form jsonb).
export const productEvents = pgTable(
  "product_events",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    name: text().notNull(),
    metadata: jsonb().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_events_user_created_idx").on(t.userId, t.createdAt), index("product_events_name_idx").on(t.name)],
);
