// Postgres schema (Drizzle) for Zorya's own domain tables. Multi-tenant from day one:
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
    // Optional structural link to a tracked `companies` row — `company` (text) above stays as the
    // freeform display value entered on the vacancy itself. Deliberately a plain single-column FK
    // to companies.id with ON DELETE SET NULL, NOT the composite (userId, companyId) + CASCADE
    // shape contacts.companyId uses below: a vacancy is high-value tracked-application data that
    // must survive its linked company being deleted, it should just lose the link, the same
    // "detach, don't cascade" call contacts.vacancyId already makes for the reverse direction.
    // Nullable — most existing rows have no link yet; a one-off script backfills by name later.
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    position: text().notNull().default(""),
    level: text().notNull().default(""),
    // Freeform, like `level` above — not structured min/max/currency columns: candidates paste
    // whatever the posting itself says ("$90k-110k", "80000 UAH/mo", "negotiable"), and forcing
    // that into a single currency/number pair would lose information for the common case of a
    // vague or range-only listing. "" means "not set" (same tri-state convention as level/notes).
    salary: text().notNull().default(""),
    url: text().notNull().default(""),
    status: text().notNull().default("Want to apply"),
    fit: text().notNull().default("med"),
    // A user-set flag for quickly finding a vacancy again (a table/kanban toggle, a "favorites
    // only" filter) — no ordering/priority semantics beyond "starred or not", so a plain boolean
    // rather than e.g. a numeric rank.
    favorite: boolean().notNull().default(false),
    // Deliberately `text`, not `date`: these are tri-state today ("" means "not set", see
    // shared/validation.ts#toDateOrEmpty) and compared as strings elsewhere (e.g.
    // analytics.routes.ts, client/dashboard.tsx do `v.next < today`). Converting to a real
    // date would turn "" into NULL, which changes the JSON API shape — a separate, deliberate
    // follow-up, not part of this migration.
    applied: text().notNull().default(""),
    next: text().notNull().default(""),
    // Short freeform description of what `next` is actually a date FOR ("Follow up", "Prepare
    // for interview") — a bare date doesn't say what to do, this pairs with it. Same tri-state
    // convention as notes/level above: "" means "not set", NOT NULL with a default, no separate
    // boolean flag.
    nextAction: text("next_action").notNull().default(""),
    notes: text().notNull().default(""),
    stack: jsonb().$type<string[]>().notNull().default([]),
    // The saved/editable result of the "cover" tab's Generate button (writing.routes.ts's
    // POST /llm/cover-letter) — previously held only in the modal's own component state, so it
    // was lost every time the modal closed. "" means "never generated/cleared", same tri-state
    // convention as notes/level above.
    coverLetter: text("cover_letter").notNull().default(""),
    // Freeform guidance ("mention my 5 years leading X", "keep it under 150 words") fed into the
    // cover-letter prompt alongside the vacancy/CV text — saved separately from coverLetter itself
    // so regenerating doesn't require retyping it, and so it's still there if the letter is
    // cleared/edited by hand.
    coverLetterDetails: text("cover_letter_details").notNull().default(""),
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
    // Bare host like "acme.com" (normalized by a toDomain() helper elsewhere, not a full URL) —
    // used as the contact-enrichment provider/cache key. Nullable: no DEFAULT and this table
    // already has production rows, so a bare `NOT NULL` ADD COLUMN would fail; existing rows are
    // left NULL (nothing to backfill from) and the app layer treats unset as "" (contacts.repo.ts's
    // toContact() already does this for its own nullable email/linkedinUrl columns).
    website: text(),
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
    // Optional link to a tracked vacancy (e.g. "this recruiter is running the Acme process").
    // Deliberately NOT the composite-FK/cascade trick used for vacancyId elsewhere in this file
    // (vacancy_status_history, calendar_events): those rows are children of a vacancy and have no
    // reason to outlive it, but a contact is a person — deleting a vacancy must never delete the
    // person's record along with it. A composite (user_id, vacancy_id) FK can't express "SET NULL"
    // either way (it would also try to null the NOT NULL user_id column and fail), so this uses a
    // plain single-column FK straight to vacancies.id with ON DELETE SET NULL: the vacancy link is
    // cleared, the contact stays. Cross-tenant linking is still prevented, just at the app layer
    // (assertOwnVacancyOrNull in contacts.routes.ts) rather than structurally by the DB — the same
    // "defense-in-depth, not the only guard" trust already placed in that helper for calendar events.
    vacancyId: integer("vacancy_id").references(() => vacancies.id, { onDelete: "set null" }),
    email: text(),
    linkedinUrl: text("linkedin_url"),
    notes: text().notNull().default(""),
    // Where this contact came from: "posting" / "signature" (extracted from text the user gave us,
    // see modules/contacts/enrichment/posting-contacts.ts) or "manual". Plain text with an app-side
    // union rather than a pg enum — the set is expected to grow as new sources land, and an enum
    // would need a migration per value. "" is the honest value for every row that predates this
    // column: their origin genuinely isn't known, and defaulting them to "manual" would invent a
    // fact. That empty default is also what makes this safe to ADD COLUMN against a populated
    // table (see cv_shares.profileId's comment for the case where that isn't possible).
    //
    // Not decoration: it's what makes an erasure request from a person who is not a user
    // answerable ("where did you get my address") and what lets dedupe prefer a stated address
    // over a hand-typed one.
    source: text().notNull().default(""),
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
    // The video-call link for this event (Meet/Zoom/Teams/whatever) — its own column rather than
    // left buried in `notes`, because the UI has to render it as a real anchor, the .ics/Google
    // exports carry it in their own dedicated fields, and "am I 2 minutes from a call I can join
    // in one click" is the single most time-critical thing on this row. Empty string (like
    // `title`/`notes` above), not NULL, so `ADD COLUMN` on the existing non-empty table needs no
    // backfill. Validated http(s)-only at the edge (shared/validation.ts's toUrl, the same helper
    // contacts.linkedinUrl uses) — an unvalidated value here would end up in an href.
    meetingUrl: text("meeting_url").notNull().default(""),
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

// Multiple named CV/resume versions per user (e.g. "Backend", "Management") — the CV Builder's
// tab strip. Capped at 5/user in application code (cv-profiles.service.ts), not a DB constraint:
// same "app-level cap, not a check constraint" choice this codebase already makes elsewhere (see
// e.g. CvContactLinksSchema's array-size caps). `doc`/`presets` hold exactly what previously lived
// in user_kv under the flat "cvDoc"/"cvPresets" keys — validated through CvDocSchema/
// CvPresetsSchema on every read, same as before, just scoped to a row instead of a KV key.
// `position` is insertion order for the tab strip (no drag-reorder UI yet, so this is just
// "0, 1, 2, ..." at creation time).
export const cvProfiles = pgTable(
  "cv_profiles",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: userIdCol(),
    name: text().notNull().default(""),
    doc: jsonb().notNull(),
    presets: jsonb().notNull().default([]),
    position: integer().notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Covers the tab-strip list query (ordered, scoped to one user).
    index("cv_profiles_user_position_idx").on(t.userId, t.position),
    // FK target for cv_shares' composite FK below.
    uniqueIndex("cv_profiles_user_id_key").on(t.userId, t.id),
  ],
);

// Shareable public CV link (Phase 9) — GET /api/cv/public/:slug (no authed()) looks up the slug
// here and, if enabled, serves ONLY that profile's `doc` (cv_profiles) — see modules/cv-shares/.
// One row per (user, profile) — unique on (userId, profileId): "generate" upserts a fresh random
// slug rather than accumulating old ones, so a previously-shared link stops working the moment a
// new one is made for that same profile.
// `profileId` is nullable at the DB level ONLY so this migration's `ADD COLUMN` doesn't fail
// against any pre-existing rows from the single-profile era (`ALTER ... NOT NULL` with no
// DEFAULT rejects a non-empty table) — the app layer (cv-shares.repo.ts) always writes a real
// profileId; a one-off script backfills old rows once, same "one-off script, not a hand-edited
// migration" split this codebase already uses (see server/scripts/).
export const cvShares = pgTable(
  "cv_shares",
  {
    slug: text().primaryKey(),
    userId: userIdCol(),
    profileId: integer("profile_id"),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Postgres treats each NULL as distinct in a unique index, so pre-backfill rows with a NULL
    // profileId never collide with each other or with a real one.
    uniqueIndex("cv_shares_user_profile_key").on(t.userId, t.profileId),
    foreignKey({ columns: [t.userId, t.profileId], foreignColumns: [cvProfiles.userId, cvProfiles.id] }).onDelete("cascade"),
  ],
);

// One row per user — opt-in for the periodic email digest (stale applications, study streak,
// upcoming interviews/next-steps; see modules/digest/). A real `enabled` column, not a blob in
// the generic `user_kv` table (used for study streak etc.): the scheduler needs a direct
// `WHERE enabled = true` scan across EVERY user, which a jsonb value can't do without a raw SQL
// path expression — the same reason saved_searches/cv_shares get first-class columns instead of
// user_kv. userId IS the primary key (unlike other tables' surrogate `id`) since there's no
// external lookup key here (unlike cv_shares' `slug`, looked up from a public URL) — one row per
// user is the table's only real identity.
export const digestPreferences = pgTable("digest_preferences", {
  userId: userIdCol().primaryKey(),
  enabled: boolean().notNull().default(false),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true, mode: "string" }),
  // Per-event opt-outs for the push notifications (modules/notifications/) that grew out of this
  // same row. Deliberately NOT more `boolean` columns: unlike `enabled` above — which the digest
  // scheduler scans across every user (`WHERE enabled = true`), the whole reason this table exists
  // instead of a user_kv blob — these are only ever read AFTER the scheduler already has this
  // user's row in hand (it drives its pass off telegram_links, not off this table), so no query
  // ever filters on them and a jsonb blob costs nothing.
  //
  // Sparse by design: a missing key means "use the default" (shared/notifications.ts's
  // DEFAULT_NOTIFICATION_PREFS), so a new notification kind ships enabled without a backfill, and
  // only real user opt-outs ever occupy space here.
  notificationPrefs: jsonb("notification_prefs").$type<Record<string, boolean>>().notNull().default({}),
  // IANA zone (e.g. "Europe/Kyiv") captured from the browser — see notifications.routes.ts. NULL
  // means "never reported", treated as UTC by the app layer (shared/time.ts#localHourIn). Only the
  // notifications that are meaningful at a specific LOCAL hour need it (the evening streak nudge);
  // everything else fires off an absolute instant and is timezone-independent.
  timezone: text(),
});

// Dedupe ledger for one-shot notifications (modules/notifications/). The schedulers tick far more
// often than any single reminder should fire — the notifications tick is every 15 minutes, so
// "your interview is tomorrow" would otherwise go out 96 times — and `digest_preferences.lastSentAt`
// can't express this: that's ONE marker per user for one weekly job, whereas these are per-user
// PER-ENTITY ("interview 42, the 24h warning"). Hence a row per (user, key).
//
// `key` is an opaque app-level string built by notifications.service.ts#notificationKey (e.g.
// "interview:42:24h") — deliberately not parsed or indexed on, only ever matched whole.
//
// The row doubles as a debounce, not just a once-ever latch: notifications.repo.ts#claimNotification
// takes a TTL and re-claims a key whose sent_at is older than it (that's what keeps one visitor
// refreshing a public CV from sending a ping per page load). A once-ever latch is just the same
// call with an infinite TTL.
//
// Swept lazily by the scheduler rather than by a cron of its own, same reasoning as
// telegram.repo.ts#resolveLinkToken's expired-token sweep — hence the sent_at index.
export const notificationsSent = pgTable(
  "notifications_sent",
  {
    userId: userIdCol(),
    key: text().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The claim path's ON CONFLICT target, and the covering index for it.
    primaryKey({ columns: [t.userId, t.key] }),
    // Covers the housekeeping sweep's `WHERE sent_at < cutoff`, which is not scoped to a user.
    index("notifications_sent_sent_at_idx").on(t.sentAt),
  ],
);
