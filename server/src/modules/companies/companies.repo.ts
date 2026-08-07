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
  website: string;
}

// companies.website is nullable at the DB level (see db/schema/app.ts's comment on why) —
// normalized to "" at this API boundary, same pattern contacts.repo.ts's toContact() uses for its
// own nullable email/linkedinUrl columns.
function toCompany(row: typeof companies.$inferSelect): Company {
  return { id: row.id, name: row.name, notes: row.notes, questions: row.questions, website: row.website ?? "" };
}

export async function listCompanies(userId: UserId): Promise<Company[]> {
  const rows = await db.select().from(companies).where(eq(companies.userId, userId)).orderBy(companies.name);
  return rows.map(toCompany);
}

export async function upsertCompany(userId: UserId, input: CompanyInput): Promise<void> {
  await db
    .insert(companies)
    .values({ userId, name: input.name, notes: input.notes, questions: input.questions, website: input.website || null })
    .onConflictDoUpdate({
      target: [companies.userId, companies.name],
      set: { notes: input.notes, questions: input.questions, website: input.website || null },
    });
}

/**
 * Non-destructive sibling of upsertCompany() above, for auto-created companies (see
 * vacancy-analysis.service.ts's fetchVacancyDetails and POST /companies/enrich): creates the row
 * when it's new, and for an existing one fills ONLY the fields that are still empty.
 *
 * upsertCompany() can't be used for this: its ON CONFLICT sets notes/questions/website
 * unconditionally, so importing a second vacancy from an employer the user already keeps notes on
 * would silently replace those notes with generated text. Machine-generated content may fill a
 * blank; it must never overwrite something the user wrote.
 *
 * The insert-first shape (rather than "look up, then insert or update") is what makes it safe
 * against two concurrent imports of the same employer racing past the same "doesn't exist yet"
 * check — ON CONFLICT DO NOTHING means the loser simply falls through to the fill-empty path.
 */
export async function upsertCompanyEnrichment(userId: UserId, input: CompanyInput): Promise<Company> {
  const [inserted] = await db
    .insert(companies)
    .values({ userId, name: input.name, notes: input.notes, questions: input.questions, website: input.website || null })
    .onConflictDoNothing({ target: [companies.userId, companies.name] })
    .returning();
  if (inserted) return toCompany(inserted);

  const existing = await findCompanyByName(userId, input.name);
  // Only reachable if the row vanished between the two statements (a concurrent delete) — nothing
  // left to enrich, so report what the caller asked for rather than inventing an id.
  if (!existing) return { id: 0, name: input.name, notes: input.notes, questions: input.questions, website: input.website ?? "" };

  const [row] = await db
    .update(companies)
    .set({
      notes: existing.notes.trim() ? existing.notes : input.notes,
      questions: existing.questions.length ? existing.questions : input.questions,
      website: existing.website || input.website || null,
    })
    .where(and(eq(companies.userId, userId), eq(companies.id, existing.id)))
    .returning();
  return row ? toCompany(row) : existing;
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
    .set({ name: input.name, notes: input.notes, questions: input.questions, website: input.website || null })
    .where(and(eq(companies.userId, userId), eq(companies.id, id)))
    .returning();
  return row ? toCompany(row) : undefined;
}

// Also used by companies.routes.ts's PUT /companies/:id to reject renaming into a name already
// used by another of this user's companies (the unique index is on (userId, name)).
export async function findCompanyByName(userId: UserId, name: string): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.name, name)));
  return row ? toCompany(row) : undefined;
}

// Added for modules/contacts/ (a contact can optionally link to a company) — confirms a given
// companyId actually belongs to this user before contacts.routes.ts allows linking to it,
// same "clean 400 instead of an opaque FK-violation 500" pattern as calendar.routes.ts'
// assertOwnVacancyOrNull. Also used by contacts.routes.ts's POST /contacts/enrich to resolve a
// domain from the linked company's `website` when the caller didn't pass one explicitly.
export async function getCompanyById(userId: UserId, id: number): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.id, id)));
  return row ? toCompany(row) : undefined;
}
