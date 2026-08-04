// Postgres schema (Drizzle) for DevRadar's own domain tables. Multi-tenant from day one:
// every table carries `userId`, a real FK to better-auth's `user` table (schema/auth.ts) with
// ON DELETE CASCADE — deleting a user's account cleanly removes all of their data.
import {
  pgTable,
  integer,
  text,
  jsonb,
  date,
  timestamp,
  real,
  boolean,
  vector,
  index,
  uniqueIndex,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
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
    // Embedding of a synthesized "position at company. Level: X. Stack: ...notes" text blob
    // (shared/vacancy-text.ts's vacancyEmbeddingText()) — computed best-effort on create/update
    // when OpenAI embeddings are available (llm/embeddings.ts#embeddingsAvailable()), left NULL
    // otherwise/offline (never blocks the request). 1536 dims matches text-embedding-3-small
    // (llm/embeddings.ts#EMBEDDING_MODEL). Never returned to the client — see vacancies.repo.ts's
    // explicit column projection (VACANCY_COLUMNS), which deliberately omits it.
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => [
    // Covers `ORDER BY id DESC` scoped to one user — the /vacancies list query.
    index("vacancies_user_id_idx").on(t.userId, t.id.desc()),
    // Covers the import path's existence check (`SELECT id WHERE url=?`), scoped per user.
    // Deliberately non-unique: many rows have url='' and pre-existing data may have dupes.
    index("vacancies_user_url_idx").on(t.userId, t.url),
    // Approximate nearest-neighbor search for findSimilarVacancies() — HNSW is pgvector's
    // recommended default index type (better query performance than IVFFlat, no separate
    // "training" build step). Requires `CREATE EXTENSION vector` (see the migration SQL).
    index("vacancies_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
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
  (t) => [
    // companies.repo.ts#upsertCompany's ON CONFLICT target is [userId, name] (not just name),
    // so this composite index is what actually backs it — a same-named company in two different
    // users' lists never collides.
    uniqueIndex("companies_user_name_key").on(t.userId, t.name),
    // FK target for contacts' composite FK below (Phase 9) — same "vacancies_user_id_key" trick.
    uniqueIndex("companies_user_id_key").on(t.userId, t.id),
  ],
);

// Networking/contact tracker (Phase 9) — deliberately its own table rather than piggybacking on
// `companies` (a contact is a person, a company is an org; a contact optionally BELONGS to one).
export const contacts = pgTable(
  "contacts",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    name: text().notNull().default(""),
    role: text(),
    // Optional link to a tracked company. Nullable — plenty of networking contacts (a recruiter
    // reached on LinkedIn, a conference acquaintance) aren't tied to any company row yet. Same
    // composite-FK trick as vacancy_status_history/calendar_events above: MATCH SIMPLE means the
    // constraint is only checked when companyId is non-null, so a contact can never end up
    // pointing at ANOTHER user's company, while an unlinked contact is unaffected.
    companyId: integer("company_id"),
    email: text(),
    linkedinUrl: text("linkedin_url"),
    notes: text().notNull().default(""),
    lastContactAt: date("last_contact_at", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.userId, t.companyId], foreignColumns: [companies.userId, companies.id] }).onDelete("cascade"),
    // FK target for calendar_events' composite FK below.
    uniqueIndex("contacts_user_id_key").on(t.userId, t.id),
    // Covers the list view (`ORDER BY name`, scoped to one user).
    index("contacts_user_name_idx").on(t.userId, t.name),
  ],
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
  // db/kv.ts's SRS upsert ON CONFLICT target is [userId, cardId] (not just cardId), backed by
  // this composite primary key — a shared card id never lets one user's review overwrite another's.
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

// Manual calendar entries (interviews/calls/deadlines/reminders) for the unified Calendar
// feature — see modules/calendar/. Read-only calendar items surfaced from elsewhere (a
// vacancy's `next` date, SRS due-cards) are NOT stored here; they're derived on the fly by
// calendar.service.ts from the vacancies/srs tables, so there's exactly one source of truth for
// each of those dates.
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    title: text().notNull().default(""),
    notes: text().notNull().default(""),
    // mode:"string" (like srs.lastReview above) — the API/client deal in ISO strings directly,
    // no need to round-trip through a JS Date for a value that's only ever displayed/compared.
    startAt: timestamp("start_at", { withTimezone: true, mode: "string" }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true, mode: "string" }),
    // "interview" | "call" | "deadline" | "reminder" | "other" — validated in shared/validation.ts,
    // not a Postgres enum (matches this codebase's existing preference for text + app-level
    // validation over DB enums, e.g. vacancies.status/fit above).
    type: text().notNull().default("other"),
    // Optional link to a tracked vacancy (e.g. "on-site interview for this vacancy"). Nullable —
    // a plain personal reminder has no vacancy at all. The composite FK below (not just a plain
    // `references(() => vacancies.id)`) is what makes it structurally impossible for a manual
    // event to end up pointing at ANOTHER user's vacancy, the same guarantee
    // vacancy_status_history relies on above. Postgres's default MATCH SIMPLE means the FK is
    // only checked when vacancyId is non-null (a NULL vacancyId always satisfies it), so an
    // unlinked event is unaffected. ON DELETE CASCADE (not SET NULL): a composite FK's "SET NULL"
    // would null out every referencing column, including the NOT NULL userId — deleting the
    // linked vacancy removes the calendar entry with it instead, mirroring how deleting a vacancy
    // already removes its status history.
    vacancyId: integer("vacancy_id"),
    // Same optional-link/composite-FK story as vacancyId above, but to the Phase 9 `contacts`
    // table (e.g. "coffee chat with this contact") — added alongside contacts itself since it's
    // a single column + one more composite FK, not a structural change to this migration.
    contactId: integer("contact_id"),
  },
  (t) => [
    foreignKey({ columns: [t.userId, t.vacancyId], foreignColumns: [vacancies.userId, vacancies.id] }).onDelete("cascade"),
    foreignKey({ columns: [t.userId, t.contactId], foreignColumns: [contacts.userId, contacts.id] }).onDelete("cascade"),
    // Covers the month-grid "events overlapping this date range, for this user" query.
    index("calendar_events_user_start_idx").on(t.userId, t.startAt),
  ],
);

// Job alerts (Phase 9) — a saved query+region the scheduler (modules/saved-searches/
// saved-searches.scheduler.ts) periodically re-runs against the same aggregators /jobs/search
// already uses, diffing against `lastSeenUrls` to email only newly-appeared postings.
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    query: text().notNull().default(""),
    region: text().notNull().default("all"),
    label: text(),
    // URLs already seen for this saved search, as of the last scheduler run — a plain jsonb
    // array (not a separate table): bounded in size (capped at a few hundred by the scheduler
    // before writing back) and only ever read/written as a whole by the one background job that
    // owns it, so a relational child table would add join overhead for no real benefit here.
    lastSeenUrls: jsonb("last_seen_urls").$type<string[]>().notNull().default([]),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Covers the list view (scoped to one user) and the scheduler's full-table scan (see
    // saved-searches.repo.ts#listAllSavedSearches — deliberately unscoped, the one legitimate
    // "all users" query in this module, used only by the background job, never a route).
    index("saved_searches_user_id_idx").on(t.userId, t.id),
  ],
);

// Shareable public CV link (Phase 9) — GET /api/cv/public/:slug (no authed()) looks up the slug
// here and, if enabled, serves ONLY that user's `cvDoc` (user_kv) — see modules/cv-shares/.
// One row per user (unique on userId): "generate" upserts a fresh random slug rather than
// accumulating old ones, so a previously-shared link stops working the moment a new one is made.
export const cvShares = pgTable(
  "cv_shares",
  {
    slug: text().primaryKey(),
    userId: userIdCol(),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cv_shares_user_id_key").on(t.userId)],
);
