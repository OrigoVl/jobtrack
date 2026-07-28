// Async repository wrapping the `vacancies` table — extracted from vacancies.routes.ts (was 18
// separate db.prepare() call sites) so the route file stays thin and this data-access logic is
// unit-testable without an Express request/response.
//
// Every function takes `userId` as its first argument (see server/src/db/user-id.ts), but the
// CURRENT SQLite-backed query bodies don't actually filter by it — same interim state as
// companies.repo.ts and db/kv.ts: real per-tenant filtering starts working once this file's
// implementation is swapped to the Postgres schema (server/src/db/schema/app.ts).
import db from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import type { VacancyRow } from "../../db/types.js";

export async function listVacancies(_userId: UserId, page?: { limit: number; offset: number }): Promise<VacancyRow[]> {
  return (page
    ? db.prepare("SELECT * FROM vacancies ORDER BY id DESC LIMIT ? OFFSET ?").all(page.limit, page.offset)
    : db.prepare("SELECT * FROM vacancies ORDER BY id DESC").all()) as unknown as VacancyRow[];
}

export async function getVacancy(_userId: UserId, id: number | string): Promise<VacancyRow | undefined> {
  return db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow | undefined;
}

export async function findVacancyByUrl(_userId: UserId, url: string): Promise<VacancyRow | undefined> {
  return db.prepare("SELECT * FROM vacancies WHERE url=?").get(url) as unknown as VacancyRow | undefined;
}

export async function findVacancyByCompanyPosition(_userId: UserId, company: string, position: string): Promise<VacancyRow | undefined> {
  return db
    .prepare("SELECT * FROM vacancies WHERE lower(company)=lower(?) AND lower(position)=lower(?)")
    .get(company, position) as unknown as VacancyRow | undefined;
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

export async function createVacancy(_userId: UserId, b: NewVacancy): Promise<number> {
  const info = db
    .prepare("INSERT INTO vacancies (company,position,level,url,status,fit,applied,next,notes,stack) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(b.company, b.position, b.level, b.url, b.status, b.fit, b.applied, b.next, b.notes, JSON.stringify(b.stack));
  return Number(info.lastInsertRowid);
}

/** Minimal insert for DOU import — mirrors the historical `(company,position,url,status)`-only column set. */
export async function createVacancyMinimal(
  _userId: UserId,
  b: { company: string; position: string; url: string; status: string },
): Promise<number> {
  const info = db
    .prepare("INSERT INTO vacancies (company,position,url,status) VALUES (?,?,?,?)")
    .run(b.company, b.position, b.url, b.status);
  return Number(info.lastInsertRowid);
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

export async function createVacancyFromJson(_userId: UserId, item: JsonVacancyInsert): Promise<number> {
  const info = db
    .prepare("INSERT INTO vacancies (company,position,level,url,status,fit,applied,next,notes,stack) VALUES (?,?,?,?,?,?,?,?,?,'[]')")
    .run(item.company, item.position, item.level, item.url, item.status, item.fit, item.applied, item.next, item.notes);
  return Number(info.lastInsertRowid);
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

export async function updateVacancy(_userId: UserId, id: number | string, m: VacancyUpdate): Promise<void> {
  db.prepare("UPDATE vacancies SET company=?,position=?,level=?,url=?,status=?,fit=?,applied=?,next=?,notes=?,stack=? WHERE id=?").run(
    m.company,
    m.position,
    m.level,
    m.url,
    m.status,
    m.fit,
    m.applied,
    m.next,
    m.notes,
    JSON.stringify(m.stack),
    id,
  );
}

export async function updateVacancyFromJson(_userId: UserId, id: number, item: JsonVacancyInsert): Promise<void> {
  db.prepare("UPDATE vacancies SET company=?,position=?,level=?,url=?,status=?,fit=?,applied=?,next=?,notes=? WHERE id=?").run(
    item.company,
    item.position,
    item.level,
    item.url,
    item.status,
    item.fit,
    item.applied,
    item.next,
    item.notes,
    id,
  );
}

export async function updateVacancyEnrichment(
  _userId: UserId,
  id: number | string,
  e: { stack: string[]; level: string; fit: string },
): Promise<void> {
  db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(JSON.stringify(e.stack), e.level, e.fit, id);
}

export async function deleteVacancy(_userId: UserId, id: number | string): Promise<number> {
  const info = db.prepare("DELETE FROM vacancies WHERE id=?").run(id);
  return Number(info.changes);
}

export async function listVacanciesWithUrl(_userId: UserId): Promise<VacancyRow[]> {
  return db.prepare("SELECT * FROM vacancies WHERE url IS NOT NULL AND url<>''").all() as unknown as VacancyRow[];
}
