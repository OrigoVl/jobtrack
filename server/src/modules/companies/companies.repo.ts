// Async repository wrapping the `companies` table — extracted from companies.routes.ts so the
// route stays thin (parse → delegate → respond) and this data-access logic is unit-testable
// without an Express request/response.
//
// Every function below takes `userId` as its first argument (see server/src/db/user-id.ts for
// why), but the CURRENT SQLite-backed query bodies don't actually filter by it: the physical
// `companies` table has no user_id column yet, and there is exactly one user (the phase-2
// bootstrap constant) until better-auth lands in phase 3. Real per-tenant filtering starts
// working the moment this file's implementation is swapped to the Postgres schema in
// server/src/db/schema/app.ts (which already has `user_id` on every table) — no caller of this
// repository has to change for that swap, only the bodies below do.
import db from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import type { CompanyRow } from "../../db/types.js";
import { j } from "../../db/helpers.js";
import type { CompanyInput } from "../../shared/validation.js";

export interface Company {
  id: number;
  name: string;
  notes: string;
  questions: string[];
}

function withQuestions(row: CompanyRow): Company {
  return { id: row.id, name: row.name, notes: row.notes, questions: j(row.questions) };
}

export async function listCompanies(_userId: UserId): Promise<Company[]> {
  const rows = db.prepare("SELECT * FROM companies ORDER BY name").all() as unknown as CompanyRow[];
  return rows.map(withQuestions);
}

export async function upsertCompany(_userId: UserId, input: CompanyInput): Promise<void> {
  // ON CONFLICT(name) is a global uniqueness rule today — fine with one tenant, but once this
  // repository moves to Postgres it MUST become ON CONFLICT (user_id, name) (see the
  // `companies_user_name_key` unique index in schema/app.ts), or one user's upsert would
  // silently overwrite another user's company row that happens to share a name.
  db.prepare("INSERT INTO companies (name,notes,questions) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET notes=?,questions=?").run(
    input.name,
    input.notes,
    JSON.stringify(input.questions),
    input.notes,
    JSON.stringify(input.questions),
  );
}
