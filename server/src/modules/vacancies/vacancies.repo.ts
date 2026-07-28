// Repository wrapping the `vacancies` table — extracted from vacancies.routes.ts (was 18
// separate db.prepare() call sites) so the route file stays thin and this data-access logic is
// unit-testable without an Express request/response. Every function is scoped by `userId` (see
// server/src/db/user-id.ts).
import { and, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import db from "../../db/client.js";
import { vacancies } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { VacancyRow } from "../../db/types.js";

export async function listVacancies(userId: UserId, page?: { limit: number; offset: number }): Promise<VacancyRow[]> {
  const q = db.select().from(vacancies).where(eq(vacancies.userId, userId)).orderBy(desc(vacancies.id));
  return page ? q.limit(page.limit).offset(page.offset) : q;
}

export async function getVacancy(userId: UserId, id: number | string): Promise<VacancyRow | undefined> {
  const [row] = await db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, Number(id))));
  return row;
}

export async function findVacancyByUrl(userId: UserId, url: string): Promise<VacancyRow | undefined> {
  const [row] = await db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.url, url)));
  return row;
}

export async function findVacancyByCompanyPosition(userId: UserId, company: string, position: string): Promise<VacancyRow | undefined> {
  const [row] = await db
    .select()
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
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  notes: string;
  stack: string[];
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
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  notes: string;
  stack: string[];
}

export async function updateVacancy(userId: UserId, id: number | string, m: VacancyUpdate): Promise<void> {
  await db
    .update(vacancies)
    .set(m)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, Number(id))));
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
  await db
    .update(vacancies)
    .set(e)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, Number(id))));
}

export async function deleteVacancy(userId: UserId, id: number | string): Promise<number> {
  const deleted = await db
    .delete(vacancies)
    .where(and(eq(vacancies.userId, userId), eq(vacancies.id, Number(id))))
    .returning({ id: vacancies.id });
  return deleted.length;
}

export async function listVacanciesWithUrl(userId: UserId): Promise<VacancyRow[]> {
  return db
    .select()
    .from(vacancies)
    .where(and(eq(vacancies.userId, userId), isNotNull(vacancies.url), ne(vacancies.url, "")));
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
