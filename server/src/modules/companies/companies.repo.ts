// Repository wrapping the `companies` table — extracted from companies.routes.ts so the route
// stays thin (parse → delegate → respond) and this data-access logic is unit-testable without
// an Express request/response. Every function is scoped by `userId` (see server/src/db/user-id.ts).
import { and, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { getKvJson, setKvJson } from "../../db/kv.js";
import { companies } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { CompanyInput } from "../../shared/validation.js";
import type { DesignDiagram } from "../design/design.service.js";

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

// A freeform system-architecture diagram attached to a company (e.g. "here's how their system
// works, from what I learned in the interview") — reuses the architecture trainer's canvas
// (client/src/features/design/design-canvas.tsx) with no task/grading involved. Stored in
// user_kv, NOT a new column on `companies`: a diagram-only save must never risk silently wiping
// `notes`/`questions` the way companies.routes.ts's non-partial upsert would, and this matches
// the design module's own `designExercise` blob pattern (no migration needed).
const companyDiagramKey = (companyId: number) => `companyDiagram:${companyId}`;

export async function getCompanyDiagram(userId: UserId, companyId: number): Promise<DesignDiagram | null> {
  return getKvJson<DesignDiagram>(userId, companyDiagramKey(companyId));
}

export async function setCompanyDiagram(userId: UserId, companyId: number, diagram: DesignDiagram): Promise<void> {
  await setKvJson(userId, companyDiagramKey(companyId), diagram);
}
