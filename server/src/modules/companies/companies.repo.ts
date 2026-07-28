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

// Only used by data-isolation tests (see companies.repo.test.ts) — not exercised by any route,
// since companies.routes.ts never needs to look one up by id directly.
export async function findCompanyByName(userId: UserId, name: string): Promise<Company | undefined> {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), eq(companies.name, name)));
  return row;
}
