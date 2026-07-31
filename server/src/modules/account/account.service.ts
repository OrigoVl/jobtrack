// Self-service data export ("what does DevRadar know about me") — the part of Phase 7's backup
// story that Railway's own Postgres backups don't cover: a per-user, portable copy the user can
// download themselves. Deliberately excludes llm_usage/product_events: those are operational
// telemetry ABOUT the user's usage (cost, timing), not content they created — the same
// distinction admin.service.ts's PII note draws for the admin panel.
import { eq } from "drizzle-orm";
import db from "../../db/client.js";
import { companies, srs, userKv, vacancies, vacancyStatusHistory } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";

export interface AccountExport {
  exportedAt: string;
  profile: Record<string, unknown>;
  vacancies: (typeof vacancies.$inferSelect)[];
  companies: (typeof companies.$inferSelect)[];
  vacancyStatusHistory: (typeof vacancyStatusHistory.$inferSelect)[];
  srs: (typeof srs.$inferSelect)[];
}

export async function exportAccountData(userId: UserId): Promise<AccountExport> {
  const [kv, vac, comp, history, srsRows] = await Promise.all([
    db.select().from(userKv).where(eq(userKv.userId, userId)),
    db.select().from(vacancies).where(eq(vacancies.userId, userId)),
    db.select().from(companies).where(eq(companies.userId, userId)),
    db.select().from(vacancyStatusHistory).where(eq(vacancyStatusHistory.userId, userId)),
    db.select().from(srs).where(eq(srs.userId, userId)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    // user_kv holds profile/cvDoc/cvPresets/genDrills/genCards/*Progress — everything keyed by a
    // free-form `k`, so a plain object (k -> v) is the natural export shape for it.
    profile: Object.fromEntries(kv.map((row) => [row.k, row.v])),
    vacancies: vac,
    companies: comp,
    vacancyStatusHistory: history,
    srs: srsRows,
  };
}
