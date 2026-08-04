// Repository wrapping the `contacts` table — mirrors companies.repo.ts almost exactly (thin,
// unit-testable data access, every function scoped by `userId`), with the extra bits contacts
// needs: an optional company link and a nullable "last contacted" date.
import { and, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { contacts } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { ContactInput } from "../../shared/validation.js";

export interface Contact {
  id: number;
  name: string;
  role: string;
  companyId: number | null;
  vacancyId: number | null;
  email: string;
  linkedinUrl: string;
  notes: string;
  /** ISO date (YYYY-MM-DD), or "" — not set. Same tri-state-via-empty-string convention the API
   * already uses for vacancies.applied/next (shared/validation.ts#toDateOrEmpty), even though the
   * DB column itself is a real nullable `date` (NULL, not ''), unlike vacancies' text column. */
  lastContactAt: string;
}

// Drizzle's inferred select type has role/email/linkedinUrl/lastContactAt as `string | null`
// (nullable columns) — this repo always normalizes null → "" at the API boundary so callers
// only ever see the tri-state-string shape above, never a raw null.
function toContact(row: typeof contacts.$inferSelect): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? "",
    companyId: row.companyId,
    vacancyId: row.vacancyId,
    email: row.email ?? "",
    linkedinUrl: row.linkedinUrl ?? "",
    notes: row.notes,
    lastContactAt: row.lastContactAt ?? "",
  };
}

export async function listContacts(userId: UserId): Promise<Contact[]> {
  const rows = await db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(contacts.name);
  return rows.map(toContact);
}

export async function getContact(userId: UserId, id: number): Promise<Contact | undefined> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.userId, userId), eq(contacts.id, id)));
  return row ? toContact(row) : undefined;
}

export interface NewContact {
  name: string;
  role: string;
  companyId: number | null;
  vacancyId: number | null;
  email: string;
  linkedinUrl: string;
  notes: string;
  lastContactAt: string;
}

export async function createContact(userId: UserId, input: NewContact): Promise<Contact> {
  const [row] = await db
    .insert(contacts)
    .values({ userId, ...input, lastContactAt: input.lastContactAt || null })
    .returning();
  return toContact(row!);
}

export async function updateContact(userId: UserId, id: number, patch: ContactInput): Promise<Contact | undefined> {
  const set: Partial<typeof contacts.$inferInsert> = { ...patch };
  if (patch.lastContactAt !== undefined) set.lastContactAt = patch.lastContactAt || null;
  const [row] = await db
    .update(contacts)
    .set(set)
    .where(and(eq(contacts.userId, userId), eq(contacts.id, id)))
    .returning();
  return row ? toContact(row) : undefined;
}

export async function deleteContact(userId: UserId, id: number): Promise<number> {
  const deleted = await db
    .delete(contacts)
    .where(and(eq(contacts.userId, userId), eq(contacts.id, id)))
    .returning({ id: contacts.id });
  return deleted.length;
}
