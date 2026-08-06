// Repository wrapping the `cv_profiles` table (multiple named CV/resume versions per user — the
// CV Builder's tab strip). `doc`/`presets` are re-validated through CvDocSchema/CvPresetsSchema
// on every read, same "schema is the migration point" convention the old single-blob user_kv
// storage already used — see cv.schemas.ts's own file header.
import { and, asc, eq } from "drizzle-orm";
import db from "../../db/client.js";
import { cvProfiles } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import { CvDocSchema, CvPresetsSchema, type CvDoc, type CvPreset } from "./cv.schemas.js";

export interface CvProfileSummary {
  id: number;
  name: string;
  position: number;
  updatedAt: string;
}

export interface CvProfileFull extends CvProfileSummary {
  doc: CvDoc;
  presets: CvPreset[];
}

function toSummary(row: typeof cvProfiles.$inferSelect): CvProfileSummary {
  return { id: row.id, name: row.name, position: row.position, updatedAt: row.updatedAt.toISOString() };
}

function toFull(row: typeof cvProfiles.$inferSelect): CvProfileFull {
  return { ...toSummary(row), doc: CvDocSchema.parse(row.doc), presets: CvPresetsSchema.parse(row.presets) };
}

export async function listProfiles(userId: UserId): Promise<CvProfileSummary[]> {
  const rows = await db
    .select()
    .from(cvProfiles)
    .where(eq(cvProfiles.userId, userId))
    .orderBy(asc(cvProfiles.position), asc(cvProfiles.id));
  return rows.map(toSummary);
}

export async function countProfiles(userId: UserId): Promise<number> {
  const rows = await db.select({ id: cvProfiles.id }).from(cvProfiles).where(eq(cvProfiles.userId, userId));
  return rows.length;
}

export async function getProfileFull(userId: UserId, id: number): Promise<CvProfileFull | undefined> {
  const [row] = await db
    .select()
    .from(cvProfiles)
    .where(and(eq(cvProfiles.userId, userId), eq(cvProfiles.id, id)));
  return row ? toFull(row) : undefined;
}

export interface NewCvProfile {
  name: string;
  doc: CvDoc;
  presets: CvPreset[];
  position: number;
}

export async function createProfile(userId: UserId, input: NewCvProfile): Promise<CvProfileFull> {
  const [row] = await db
    .insert(cvProfiles)
    .values({ userId, ...input })
    .returning();
  return toFull(row!);
}

export async function updateProfileDoc(userId: UserId, id: number, doc: CvDoc): Promise<CvDoc | undefined> {
  const [row] = await db
    .update(cvProfiles)
    .set({ doc, updatedAt: new Date() })
    .where(and(eq(cvProfiles.userId, userId), eq(cvProfiles.id, id)))
    .returning({ doc: cvProfiles.doc });
  return row ? CvDocSchema.parse(row.doc) : undefined;
}

export async function updateProfilePresets(userId: UserId, id: number, presets: CvPreset[]): Promise<CvPreset[] | undefined> {
  const [row] = await db
    .update(cvProfiles)
    .set({ presets, updatedAt: new Date() })
    .where(and(eq(cvProfiles.userId, userId), eq(cvProfiles.id, id)))
    .returning({ presets: cvProfiles.presets });
  return row ? CvPresetsSchema.parse(row.presets) : undefined;
}

export async function renameProfile(userId: UserId, id: number, name: string): Promise<CvProfileSummary | undefined> {
  const [row] = await db
    .update(cvProfiles)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(cvProfiles.userId, userId), eq(cvProfiles.id, id)))
    .returning();
  return row ? toSummary(row) : undefined;
}

export async function deleteProfile(userId: UserId, id: number): Promise<number> {
  const deleted = await db
    .delete(cvProfiles)
    .where(and(eq(cvProfiles.userId, userId), eq(cvProfiles.id, id)))
    .returning({ id: cvProfiles.id });
  return deleted.length;
}
