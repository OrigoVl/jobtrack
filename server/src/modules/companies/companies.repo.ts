// Repository wrapping the `companies` table — extracted from companies.routes.ts so the route
// stays thin (parse → delegate → respond) and this data-access logic is unit-testable without
// an Express request/response. Every function is scoped by `userId` (see server/src/db/user-id.ts).
import { and, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { companies } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { CompanyInput } from "../../shared/validation.js";

export interface Company {
  id: number;
  name: string;
  notes: string;
  questions: string[];
}

export async function listCompanies(userId: UserId): Promise<Company[]> {
  return db.select().from(companies).where(eq(companies.userId, userId)).orderBy(companies.name);
}

export async function upsertCompany(userId: UserId, input: CompanyInput): Promise<void> {
  await db
    .insert(companies)
    .values({ userId, name: input.name, notes: input.notes, questions: input.questions })
    .onConflictDoUpdate({
      target: [companies.userId, companies.name],
      set: { notes: input.notes, questions: input.questions },
    });
}

// Cascades to that company's `contacts` rows (see contacts' composite FK in db/schema/app.ts).
export async function deleteCompany(userId: UserId, id: number): Promise<number> {
  const deleted = await db
    .delete(companies)
    .where(and(eq(companies.userId, userId), eq(companies.id, id)))
    .returning({ id: companies.id });
  return deleted.length;
}

// Update-by-id (unlike upsertCompany, which matches on name) — the only way to rename a company,
// since renaming through upsertCompany's (userId, name) conflict target would just insert a new
// row under the new name and leave the old one behind. companies.routes.ts checks the new name
// isn't already taken by another row (via findCompanyByName) before calling this, for a clean 409
// instead of surfacing the raw `companies_user_name_key` violation.
export async function updateCompany(userId: UserId, id: number, input: CompanyInput): Promise<Company | undefined> {
  const [row] = await db
    .update(companies)
    .set({ name: input.name, notes: input.notes, questions: input.questions })
    .where(and(eq(companies.userId, userId), eq(companies.id, id)))
    .returning();
  return row;
}

// Also used by companies.routes.ts's PUT /companies/:id to reject renaming into a name already
// used by another of this user's companies (the unique index is on (userId, name)).
export async function findCompanyByName(userId: UserId, name: string): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.name, name)));
  return row;
}

// Added for modules/contacts/ (a contact can optionally link to a company) — confirms a given
// companyId actually belongs to this user before contacts.routes.ts allows linking to it,
// same "clean 400 instead of an opaque FK-violation 500" pattern as calendar.routes.ts'
// assertOwnVacancyOrNull.
export async function getCompanyById(userId: UserId, id: number): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.id, id)));
  return row;
}
