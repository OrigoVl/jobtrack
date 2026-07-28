// Postgres schema (Drizzle) for JobTrack's own domain tables. Multi-tenant from day one:
// every table carries `userId`, a real FK to better-auth's `user` table (schema/auth.ts) with
// ON DELETE CASCADE — deleting a user's account cleanly removes all of their data.
import { pgTable, integer, text, jsonb, date, timestamp, real, index, uniqueIndex, primaryKey, foreignKey } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

const userIdCol = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const vacancies = pgTable(
  "vacancies",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    company: text().notNull().default(""),
    position: text().notNull().default(""),
    level: text().notNull().default(""),
    url: text().notNull().default(""),
    status: text().notNull().default("Want to apply"),
    fit: text().notNull().default("med"),
    // Deliberately `text`, not `date`: these are tri-state today ("" means "not set", see
    // shared/validation.ts#toDateOrEmpty) and compared as strings elsewhere (e.g.
    // analytics.routes.ts, client/dashboard.tsx do `v.next < today`). Converting to a real
    // date would turn "" into NULL, which changes the JSON API shape — a separate, deliberate
    // follow-up, not part of this migration.
    applied: text().notNull().default(""),
    next: text().notNull().default(""),
    notes: text().notNull().default(""),
    stack: jsonb().$type<string[]>().notNull().default([]),
    // `date('now')` in SQLite already produced 'YYYY-MM-DD' — mode:"string" keeps the wire
    // format byte-identical, since recencyWeight() and analytics chart bucketing parse/compare
    // this value directly as a string.
    created: date({ mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    // Covers `ORDER BY id DESC` scoped to one user — the /vacancies list query.
    index("vacancies_user_id_idx").on(t.userId, t.id.desc()),
    // Covers the import path's existence check (`SELECT id WHERE url=?`), scoped per user.
    // Deliberately non-unique: many rows have url='' and pre-existing data may have dupes.
    index("vacancies_user_url_idx").on(t.userId, t.url),
    // FK target for vacancy_status_history's composite FK below.
    uniqueIndex("vacancies_user_id_key").on(t.userId, t.id),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    name: text().notNull(),
    notes: text().notNull().default(""),
    questions: jsonb().$type<string[]>().notNull().default([]),
  },
  // The upsert in companies.routes.ts does ON CONFLICT(name) today; under multi-tenancy that
  // must become ON CONFLICT (user_id, name), or one user's upsert silently overwrites another
  // user's company row with the same name.
  (t) => [uniqueIndex("companies_user_name_key").on(t.userId, t.name)],
);

export const srs = pgTable(
  "srs",
  {
    userId: userIdCol(),
    cardId: text("card_id").notNull(),
    // Renamed from `interval`: that's a reserved-ish word in some SQL contexts and shadows the
    // Postgres `interval` type name. `ease` is dropped entirely — db/types.ts already marks it
    // @deprecated dead SM-2 state, never read by the FSRS scheduler, never serialized to the
    // client (verified against db/types.ts#SrsRow and study.routes.ts).
    intervalDays: integer("interval_days").notNull().default(0),
    due: date({ mode: "string" }).notNull().defaultNow(),
    reps: integer().notNull().default(0),
    // NEVER `numeric` here: node-postgres returns numeric as a string, and these feed straight
    // into FSRS float math (fsrs.ts). `real`/doublePrecision round-trip as JS numbers.
    difficulty: real(),
    stability: real(),
    lastReview: timestamp("last_review", { withTimezone: true, mode: "string" }),
  },
  // The upsert in study.routes.ts does ON CONFLICT(cardId) today; under multi-tenancy that
  // must scope to (user_id, card_id), or one user's SRS review silently overwrites another
  // user's review state for a card with the same id.
  (t) => [primaryKey({ columns: [t.userId, t.cardId] })],
);

// Generic per-user key-value store: profile, drill/roadmap/checklist progress, everything that
// isn't a first-class relational table. Composite PK (user_id, k), user_id leading: every read
// is an exact-key lookup scoped to one user, so this PK index is the covering index for 100% of
// reads, and it also serves per-user range scans (account export/deletion).
export const userKv = pgTable(
  "user_kv",
  {
    userId: userIdCol(),
    k: text().notNull(),
    v: jsonb().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.k] })],
);

// LLM response cache — deliberately GLOBAL (no user_id). The cache key is a SHA-256 hash of the
// full prompt text (system+user+tier), so a cache hit requires a byte-identical prompt AND a
// practically-impossible hash collision (shared/hash.ts — upgraded from djb2, a 32-bit hash that
// made a collision plausible at scale, exactly because this table is shared across all tenants):
// there is no path by which user B's cache hit returns content derived from user A's different
// input. See server/src/llm/client.ts for where this is written/read.
export const llmCache = pgTable(
  "llm_cache",
  {
    k: text().primaryKey(),
    v: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("llm_cache_created_at_idx").on(t.createdAt)],
);

export const vacancyStatusHistory = pgTable(
  "vacancy_status_history",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    vacancyId: integer("vacancy_id").notNull(),
    status: text().notNull(),
    // SQLite's `datetime('now')` produced 'YYYY-MM-DD HH:MM:SS' with NO timezone marker, and it
    // WAS UTC — `new Date(that)` parsed it as local time, silently shifting every timestamp by
    // the server's UTC offset. That bug was invisible because getAvgDaysInStage() only ever
    // differences two such strings (the offset cancels out). timestamptz + mode:"date" removes
    // the trap going forward; the one-off import script must append 'Z' before parsing the old
    // SQLite values, or it reproduces the same silent shift permanently in Postgres.
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    // Composite FK makes attaching a history row to ANOTHER user's vacancy structurally
    // impossible (not just "unlikely") — the strongest guarantee available here. ON DELETE
    // CASCADE replaces the hand-rolled deleteHistoryForVacancy() call in vacancies.routes.ts.
    foreignKey({ columns: [t.userId, t.vacancyId], foreignColumns: [vacancies.userId, vacancies.id] }).onDelete("cascade"),
    // Covers "history for this vacancy, in order" (getAvgDaysInStage per vacancy).
    index("vsh_user_vacancy_changed_idx").on(t.userId, t.vacancyId, t.changedAt),
    // Covers "count of vacancies that ever reached status X" (getReachedCounts).
    index("vsh_user_status_idx").on(t.userId, t.status),
  ],
);
