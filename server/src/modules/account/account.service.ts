// Self-service data export ("what does Zorya know about me") — the part of Phase 7's backup
// story that Railway's own Postgres backups don't cover: a per-user, portable copy the user can
// download themselves. Deliberately excludes llm_usage/product_events: those are operational
// telemetry ABOUT the user's usage (cost, timing), not content they created — the same
// distinction admin.service.ts's PII note draws for the admin panel.
import { eq } from "drizzle-orm";
import db from "../../db/client.js";
import { companies, contacts, cvProfiles, srs, userKv, vacancies, vacancyStatusHistory } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

export interface AccountExport {
  exportedAt: string;
  profile: Record<string, unknown>;
  vacancies: (typeof vacancies.$inferSelect)[];
  companies: (typeof companies.$inferSelect)[];
  vacancyStatusHistory: (typeof vacancyStatusHistory.$inferSelect)[];
  srs: (typeof srs.$inferSelect)[];
  contacts: (typeof contacts.$inferSelect)[];
  cvProfiles: (typeof cvProfiles.$inferSelect)[];
}

export async function exportAccountData(userId: UserId): Promise<AccountExport> {
  const [kv, vac, comp, history, srsRows, contactRows, cvProfileRows] = await Promise.all([
    db.select().from(userKv).where(eq(userKv.userId, userId)),
    db.select().from(vacancies).where(eq(vacancies.userId, userId)),
    db.select().from(companies).where(eq(companies.userId, userId)),
    db.select().from(vacancyStatusHistory).where(eq(vacancyStatusHistory.userId, userId)),
    db.select().from(srs).where(eq(srs.userId, userId)),
    db.select().from(contacts).where(eq(contacts.userId, userId)),
    db.select().from(cvProfiles).where(eq(cvProfiles.userId, userId)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    // user_kv holds profile/genDrills/genCards/*Progress — everything keyed by a free-form `k`, so
    // a plain object (k -> v) is the natural export shape for it. CV Builder docs/presets moved out
    // to their own `cv_profiles` rows (below) once CVs became multi-profile — they're no longer
    // stored under a "cvDoc"/"cvPresets" key here.
    profile: Object.fromEntries(kv.map((row) => [row.k, row.v])),
    vacancies: vac,
    companies: comp,
    vacancyStatusHistory: history,
    srs: srsRows,
    contacts: contactRows,
    cvProfiles: cvProfileRows,
  };
}
