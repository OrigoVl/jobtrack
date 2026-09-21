// Repository wrapping the `vacancies` table — extracted from vacancies.routes.ts (was 18
// separate db.prepare() call sites) so the route file stays thin and this data-access logic is
// unit-testable without an Express request/response. Every function is scoped by `userId` (see
// server/src/db/user-id.ts).
import { and, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import db from "../../db/client.js";
import { vacancies } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { VacancyRow } from "../../db/types.js";

// An explicit column list, NOT `db.select()` (select-star) — `vacancies` also carries an
// `embedding` column (a 1536-number vector, see db/schema/app.ts and findSimilarVacancies below)
// that must never reach the client: it's sizeable dead weight over the wire, and serves no
// purpose in the UI. Every read below uses this instead of select-star specifically so a future
// column addition can't silently leak into an API response again by accident.
const VACANCY_COLUMNS = {
  id: vacancies.id,
  company: vacancies.company,
  position: vacancies.position,
  level: vacancies.level,
  salary: vacancies.salary,
  location: vacancies.location,
  workMode: vacancies.workMode,
  employmentType: vacancies.employmentType,
  url: vacancies.url,
  status: vacancies.status,
  fit: vacancies.fit,
  applied: vacancies.applied,
  next: vacancies.next,
  nextAction: vacancies.nextAction,
  notes: vacancies.notes,
  stack: vacancies.stack,
  created: vacancies.created,
  companyId: vacancies.companyId,
  favorite: vacancies.favorite,
  coverLetter: vacancies.coverLetter,
  coverLetterDetails: vacancies.coverLetterDetails,
};

export async function listVacancies(userId: UserId, page?: { limit: number; offset: number }): Promise<VacancyRow[]> {
  const q = db.select(VACANCY_COLUMNS).from(vacancies).where(eq(vacancies.userId, userId)).orderBy(desc(vacancies.id));
  return page ? q.limit(page.limit).offset(page.offset) : q;
}

// Every route handler in this module accepts `id` as `number | string` (an Express route param is
// always a string), then narrows with `Number(id)` right before the query — a non-numeric `id`
// (e.g. a route-ordering bug matching a literal path segment like "apply-goal" as `:id`, see
// vacancies.routes.ts's own comment on that exact incident) used to reach the DB driver as `NaN`,
// which postgres.js can't bind as a query param and throws a raw, unreadable SQL error straight
// through to the client. Centralizing the guard here means every one of the 6 call sites below
// fails the same safe way (treat as "no such vacancy") instead of letting `NaN` reach the driver.
function toVacancyId(id: number | string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export async function getVacancy(userId: UserId, id: number | string): Promise<VacancyRow | undefined> {
  const numId = toVacancyId(id);
  if (numId === null) return undefined;
  const [row] = await db
    .select(VACANCY_COLUMNS)
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, numId)));
  return row;
}

export async function findVacancyByUrl(userId: UserId, url: string): Promise<VacancyRow | undefined> {
  const [row] = await db
    .select(VACANCY_COLUMNS)
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.url, url)));
  return row;
}

export async function findVacancyByCompanyPosition(userId: UserId, company: string, position: string): Promise<VacancyRow | undefined> {
  const [row] = await db
    .select(VACANCY_COLUMNS)
    .from(vacancies)
    .where(
      and(
        eq(vacancies.userId, userId),
        eq(sql`lower(${vacancies.company})`, company.toLowerCase()),
        eq(sql`lower(${vacancies.position})`, position.toLowerCase()),
      ),
    );
  return row;
}

export interface NewVacancy {
  company: string;
  position: string;
  level: string;
  salary: string;
  /** Optional — omitted defaults to NULL (the column has no other default, see db/schema/app.ts's
   * own comment on why this is nullable rather than level/salary's "" convention). */
  location?: string | null;
  /** Optional — same reasoning as `location` above. */
  workMode?: string | null;
  /** Optional — same reasoning as `location` above. */
  employmentType?: string | null;
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  /** Optional — omitted defaults to the column's own DEFAULT '' (same reasoning as favorite
   * below): existing call sites/tests that predate this field don't all need updating. */
  nextAction?: string;
  notes: string;
  stack: string[];
  /** Optional — omitted defaults to NULL (the column has no other default). Optional here (unlike
   * VacancyRow's required field) so existing call sites/tests that predate the company link don't
   * all need updating just to pass `null` explicitly. */
  companyId?: number | null;
  /** Optional — omitted defaults to the column's own DEFAULT false (same reasoning as companyId
   * above: existing call sites/tests that predate favorites don't all need updating). */
  favorite?: boolean;
  /** Optional — omitted defaults to the column's own DEFAULT '' (same reasoning as favorite above). */
  coverLetter?: string;
  coverLetterDetails?: string;
}

export async function createVacancy(userId: UserId, b: NewVacancy): Promise<number> {
  const [row] = await db
    .insert(vacancies)
    .values({ userId, ...b })
    .returning({ id: vacancies.id });
  return row!.id;
}

/** Minimal insert for DOU import — mirrors the historical `(company,position,url,status)`-only column set. */
export async function createVacancyMinimal(
  userId: UserId,
  b: { company: string; position: string; url: string; status: string },
): Promise<number> {
  const [row] = await db
    .insert(vacancies)
    .values({ userId, ...b })
    .returning({ id: vacancies.id });
  return row!.id;
}

export interface JsonVacancyInsert {
  company: string;
  position: string;
  level: string;
  salary: string;
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  notes: string;
}

export async function createVacancyFromJson(userId: UserId, item: JsonVacancyInsert): Promise<number> {
  const [row] = await db
    .insert(vacancies)
    .values({ userId, ...item })
    .returning({ id: vacancies.id });
  return row!.id;
}

export interface VacancyUpdate {
  company: string;
  position: string;
  level: string;
  salary: string;
  /** Optional — see NewVacancy's own comment on why this isn't required and is nullable. */
  location?: string | null;
  /** Optional — see NewVacancy's own comment on why this isn't required and is nullable. */
  workMode?: string | null;
  /** Optional — see NewVacancy's own comment on why this isn't required and is nullable. */
  employmentType?: string | null;
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  /** Optional — see NewVacancy's own comment on why this isn't required like VacancyRow's field. */
  nextAction?: string;
  notes: string;
  stack: string[];
  /** Optional — see NewVacancy's own comment on why this isn't required like VacancyRow's field. */
  companyId?: number | null;
  favorite?: boolean;
  coverLetter?: string;
  coverLetterDetails?: string;
}

export async function updateVacancy(userId: UserId, id: number | string, m: VacancyUpdate): Promise<void> {
  const numId = toVacancyId(id);
  if (numId === null) return;
  await db
    .update(vacancies)
    .set(m)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, numId)));
}

/** Status-only update, for callers that have nothing else to write — currently the Telegram bot's
 * inline quick-action buttons (modules/telegram/telegram.commands.ts). updateVacancy() above is a
 * full-row REPLACE (every field of VacancyUpdate is required), so routing a one-field change
 * through it would mean reading the row back and re-sending all eleven columns, turning a lost
 * update race into a real risk for no benefit. Same narrow-updater shape as
 * updateVacancyEnrichment/updateVacancyImportedTitle below. */
export async function updateVacancyStatus(userId: UserId, id: number, status: string): Promise<void> {
  await db
    .update(vacancies)
    .set({ status })
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, id)));
}

export async function updateVacancyFromJson(userId: UserId, id: number, item: JsonVacancyInsert): Promise<void> {
  await db
    .update(vacancies)
    .set(item)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, id)));
}

export async function updateVacancyEnrichment(
  userId: UserId,
  id: number | string,
  e: { stack: string[]; level: string; fit: string },
): Promise<void> {
  const numId = toVacancyId(id);
  if (numId === null) return;
  await db
    .update(vacancies)
    .set(e)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, numId)));
}

/** Fills in company/position/companyId/salary/location/workMode/employmentType guessed after the
 * fact for a bulk import (see vacancies.routes.ts's POST /vacancies/import and
 * vacancy-analysis.service.ts's extractVacancyFacts/extractDouLocationHint/companyFromDouUrl) —
 * unlike a DOU export, a generic link doesn't encode most of these structurally, so the row is
 * first created with placeholders and only patched here once best-effort enrichment has run.
 * `companyId` is separate from `company` (the free-text name) since the caller only has an id
 * once it has actually created/found the `companies` row — imported vacancies used to get the
 * text name but never a real link, so the detail modal (which only shows the linked-company
 * picker, no free-text field — see VacancyDraft's own comment) displayed "No linked company" for
 * every imported vacancy even when the name was guessed correctly. */
export async function updateVacancyImportedTitle(
  userId: UserId,
  id: number,
  title: {
    company?: string;
    position?: string;
    companyId?: number;
    salary?: string;
    location?: string;
    workMode?: string;
    employmentType?: string;
  },
): Promise<void> {
  const { companyId, ...rest } = title;
  if (Object.keys(rest).length === 0 && companyId === undefined) return;
  await db
    .update(vacancies)
    .set(companyId === undefined ? rest : { ...rest, companyId })
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, id)));
}

export async function deleteVacancy(userId: UserId, id: number | string): Promise<number> {
  const numId = toVacancyId(id);
  if (numId === null) return 0;
  const deleted = await db
    .delete(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, numId)))
    .returning({ id: vacancies.id });
  return deleted.length;
}

export async function listVacanciesWithUrl(userId: UserId): Promise<VacancyRow[]> {
  return db
    .select(VACANCY_COLUMNS)
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), isNotNull(vacancies.url), ne(vacancies.url, "")));
}

/** Just the embedding column for one vacancy — the only place `vacancies.embedding` is ever
 * selected directly (findSimilarVacancies needs a reference vector; every other read goes
 * through VACANCY_COLUMNS, which excludes it). `undefined` — no such vacancy for this user;
 * `null` — the vacancy exists but has no embedding yet (offline, or not enough text). */
export async function getVacancyEmbedding(userId: UserId, id: number | string): Promise<number[] | null | undefined> {
  const numId = toVacancyId(id);
  if (numId === null) return undefined;
  const [row] = await db
    .select({ embedding: vacancies.embedding })
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, numId)));
  return row?.embedding;
}

/** Best-effort: called fire-and-forget after create/update (see vacancies.routes.ts) whenever the
 * vacancy's embeddable text changed — never awaited by the request that triggered it, so a slow
 * or failed embeddings call never adds latency to saving a vacancy. `null` clears a stale
 * embedding (e.g. the vacancy's text became empty) rather than leaving a now-inaccurate vector
 * around for findSimilarVacancies to keep matching against. */
export async function updateVacancyEmbedding(userId: UserId, id: number | string, embedding: number[] | null): Promise<void> {
  const numId = toVacancyId(id);
  if (numId === null) return;
  await db
    .update(vacancies)
    .set({ embedding })
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, numId)));
}

export interface SimilarVacancy extends VacancyRow {
  /** Cosine similarity to the reference embedding, roughly in [0,1] (1 = identical direction) —
   * `1 - cosine_distance`, per pgvector's `<=>` operator. Not clamped: unlike
   * llm/embeddings.ts#semanticSimilarity, this never sees a negative case in practice (OpenAI's
   * text embeddings point in broadly similar directions for any two pieces of English prose), so
   * clamping was judged not worth obscuring an unexpected raw value if the model ever changes. */
  similarity: number;
}

/**
 * The `limit` other vacancies (same user, excluding `excludeId`, excluding any vacancy that has
 * no embedding yet) whose embedding is closest to `embedding` by cosine distance — pgvector's
 * `<=>` operator, using the `vacancies_embedding_idx` HNSW index (db/schema/app.ts) for an
 * approximate-nearest-neighbor search instead of a full table scan. Returns `[]` (not an error)
 * if `embedding` is unavailable — see vacancies.routes.ts's `/vacancies/:id/similar`, which is
 * the only call site.
 */
export async function findSimilarVacancies(userId: UserId, embedding: number[], excludeId: number, limit = 5): Promise<SimilarVacancy[]> {
  // pgvector's text input format for a vector literal is "[0.1,0.2,...]" — `::vector` tells
  // Postgres to parse the string parameter as one instead of leaving it as `unknown`/text.
  const vectorLiteral = sql`${JSON.stringify(embedding)}::vector`;
  const distance = sql<number>`${vacancies.embedding} <=> ${vectorLiteral}`;
  return db
    .select({ ...VACANCY_COLUMNS, similarity: sql<number>`1 - (${distance})`.as("similarity") })
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), ne(vacancies.id, excludeId), isNotNull(vacancies.embedding)))
    .orderBy(distance)
    .limit(limit);
}

export async function countVacancies(userId: UserId): Promise<number> {
  const [row] = await db.select({ c: count() }).from(vacancies).where(eq(vacancies.userId, userId));
  return row!.c;
}

/** Narrow projection for the analytics funnel/byDate breakdown — see analytics.routes.ts. */
export async function listVacancyStatusRows(userId: UserId): Promise<{ status: string; created: string; applied: string }[]> {
  return db
    .select({ status: vacancies.status, created: vacancies.created, applied: vacancies.applied })
    .from(vacancies)
    .where(eq(vacancies.userId, userId));
}

/** Narrow projection for the "focus of the week" summary — see analytics.routes.ts. */
export async function listVacancyStatusNextRows(userId: UserId): Promise<{ status: string; next: string; applied: string }[]> {
  return db
    .select({ status: vacancies.status, next: vacancies.next, applied: vacancies.applied })
    .from(vacancies)
    .where(eq(vacancies.userId, userId));
}

/** Narrow projection for the email digest's "stale applications" section — see
 * modules/digest/digest.service.ts#buildStaleApplications, which needs company/position (unlike
 * listVacancyStatusNextRows above) to actually name the application in the email body. */
export async function listVacancyDigestRows(
  userId: UserId,
): Promise<{ id: number; company: string; position: string; status: string; applied: string }[]> {
  return db
    .select({
      id: vacancies.id,
      company: vacancies.company,
      position: vacancies.position,
      status: vacancies.status,
      applied: vacancies.applied,
    })
    .from(vacancies)
    .where(eq(vacancies.userId, userId));
}

/** Narrow projection for the push-notification scheduler (modules/notifications/) — the digest
 * projection above plus `next`, which the notifications need (a next step falling due today is one
 * of the things they announce) and the digest deliberately doesn't. A separate function rather than
 * widening listVacancyDigestRows: that one's return type is documented as NOT carrying `next`, and
 * digest.service.ts#VacancyDigestRow is written against exactly that shape. */
export async function listVacancyReminderRows(
  userId: UserId,
): Promise<{ id: number; company: string; position: string; status: string; applied: string; next: string }[]> {
  return db
    .select({
      id: vacancies.id,
      company: vacancies.company,
      position: vacancies.position,
      status: vacancies.status,
      applied: vacancies.applied,
      next: vacancies.next,
    })
    .from(vacancies)
    .where(eq(vacancies.userId, userId));
}
